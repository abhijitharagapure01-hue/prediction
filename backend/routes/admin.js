const router = require('express').Router();
const { db } = require('../config/firebase');
const { auth, adminAuth } = require('../middleware/auth');
const { distributeWinnings } = require('../jobs/results');

router.use(auth, adminAuth);

// Get admin wallet balance
router.get('/wallet', async (req, res) => {
  try {
    const snap = await db.ref('adminWallet').get();
    const balance = snap.exists() ? snap.val().balance : 0;
    const txSnap = await db.ref('adminTransactions').get();
    const transactions = txSnap.exists()
      ? Object.entries(txSnap.val()).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.createdAt - a.createdAt)
      : [];
    res.json({ balance, transactions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a match
router.post('/matches', async (req, res) => {
  try {
    const { teamA, teamB, startTime, endTime, entryFee = 100 } = req.body;
    console.log('[admin/matches POST] body:', JSON.stringify(req.body));

    if (!teamA || !teamB || !startTime)
      return res.status(400).json({ message: 'teamA, teamB, startTime required' });

    // datetime-local gives "YYYY-MM-DDTHH:mm" without timezone — treat as IST (UTC+5:30)
    const toIST = (val) => {
      if (!val) return null;
      const s = val.includes('+') || val.endsWith('Z') ? val : val + '+05:30';
      return new Date(s).getTime();
    };
    const startMs = toIST(startTime);
    console.log('[admin/matches POST] startMs:', startMs, 'valid:', !isNaN(startMs));

    if (!startMs || isNaN(startMs))
      return res.status(400).json({ message: 'Invalid start time — please pick a date and time' });

    const ref = db.ref('matches').push();
    await ref.set({
      teamA, teamB,
      teamAOdds: Number(req.body.teamAOdds) || 1.9,
      teamBOdds: Number(req.body.teamBOdds) || 1.9,
      startTime: startMs,
      endTime: toIST(endTime),
      status: 'UPCOMING',  // always start as UPCOMING — cron will lock at startTime
      winningTeam: null,
      entryFee: Number(entryFee),
      createdAt: Date.now(),
    });
    const snap = await ref.get();
    res.status(201).json({ id: ref.key, ...snap.val() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update match
router.put('/matches/:id', async (req, res) => {
  try {
    const toIST = (val) => {
      if (!val) return null;
      const s = val.includes('+') || val.endsWith('Z') ? val : val + '+05:30';
      return new Date(s).getTime();
    };
    const { teamA, teamB, startTime, endTime, entryFee, teamAOdds, teamBOdds } = req.body;
    const update = {};
    if (teamA) update.teamA = teamA;
    if (teamB) update.teamB = teamB;
    if (startTime) update.startTime = toIST(startTime);
    if (endTime !== undefined) update.endTime = toIST(endTime);
    if (entryFee) update.entryFee = Number(entryFee);
    if (teamAOdds) update.teamAOdds = Number(teamAOdds);
    if (teamBOdds) update.teamBOdds = Number(teamBOdds);

    await db.ref(`matches/${req.params.id}`).update(update);
    const snap = await db.ref(`matches/${req.params.id}`).get();
    res.json({ id: snap.key, ...snap.val() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Set result and distribute winnings
router.post('/matches/:id/result', async (req, res) => {
  try {
    const winningTeam = (req.body.winningTeam || '').trim();
    if (!winningTeam) return res.status(400).json({ message: 'winningTeam required' });

    const matchRef = db.ref(`matches/${req.params.id}`);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists()) return res.status(404).json({ message: 'Match not found' });
    const match = matchDoc.val();
    if (match.status === 'COMPLETED') return res.status(400).json({ message: 'Result already set' });

    await matchRef.update({ winningTeam, status: 'COMPLETED' });
    const updatedMatch = { ...match, winningTeam, status: 'COMPLETED' };
    const result = await distributeWinnings(updatedMatch, req.params.id);

    res.json({ message: 'Result set and winnings distributed', ...result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Re-run result distribution (fixes wrong LOST entries — resets LOST→PENDING then re-distributes)
router.post('/matches/:id/rerun-result', async (req, res) => {
  try {
    const matchSnap = await db.ref(`matches/${req.params.id}`).get();
    if (!matchSnap.exists()) return res.status(404).json({ message: 'Match not found' });
    const match = matchSnap.val();
    if (match.status !== 'COMPLETED' || !match.winningTeam)
      return res.status(400).json({ message: 'Match result not set yet' });

    // Reset all LOST contests for this match back to PENDING so distributeWinnings re-evaluates them
    const contestsSnap = await db.ref('contests').orderByChild('matchId').equalTo(req.params.id).get();
    if (contestsSnap.exists()) {
      for (const [id, data] of Object.entries(contestsSnap.val())) {
        if (data.status === 'LOST') {
          await db.ref(`contests/${id}`).update({ status: 'PENDING' });
        }
      }
    }

    const result = await distributeWinnings(match, req.params.id);
    res.json({ message: 'Result re-run complete', ...result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete match
router.delete('/matches/:id', async (req, res) => {
  try {
    await db.ref(`matches/${req.params.id}`).remove();
    res.json({ message: 'Match deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const snap = await db.ref('users').get();
    if (!snap.exists()) return res.json([]);
    const users = Object.entries(snap.val()).map(([id, data]) => {
      const { password, ...safe } = data;
      return { id, ...safe };
    }).sort((a, b) => b.createdAt - a.createdAt);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single user full details (contests, transactions, deposits, withdrawals)
router.get('/users/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    const [userSnap, txSnap, contestSnap, depositSnap, withdrawSnap] = await Promise.all([
      db.ref(`users/${uid}`).get(),
      db.ref('transactions').orderByChild('userId').equalTo(uid).get(),
      db.ref('contests').orderByChild('userId').equalTo(uid).get(),
      db.ref('pendingDeposits').get(),
      db.ref('withdrawals').orderByChild('userId').equalTo(uid).get(),
    ]);
    if (!userSnap.exists()) return res.status(404).json({ message: 'User not found' });
    const { password, ...user } = userSnap.val();

    const transactions = txSnap.exists()
      ? Object.entries(txSnap.val()).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.createdAt - a.createdAt)
      : [];

    const contestsRaw = contestSnap.exists()
      ? Object.entries(contestSnap.val()).map(([id, d]) => ({ id, ...d }))
      : [];
    const contests = await Promise.all(contestsRaw.map(async (c) => {
      const mSnap = await db.ref(`matches/${c.matchId}`).get();
      return { ...c, match: mSnap.exists() ? { id: mSnap.key, ...mSnap.val() } : null };
    }));
    contests.sort((a, b) => b.createdAt - a.createdAt);

    const deposits = depositSnap.exists()
      ? Object.entries(depositSnap.val()).filter(([, d]) => d.userId === uid).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.createdAt - a.createdAt)
      : [];

    const withdrawals = withdrawSnap.exists()
      ? Object.entries(withdrawSnap.val()).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.createdAt - a.createdAt)
      : [];

    res.json({ id: uid, ...user, transactions, contests, deposits, withdrawals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clear user wallet to zero
router.post('/users/:id/clear-wallet', async (req, res) => {
  try {
    const uid = req.params.id;
    const userSnap = await db.ref(`users/${uid}`).get();
    if (!userSnap.exists()) return res.status(404).json({ message: 'User not found' });
    const prev = userSnap.val().walletBalance || 0;
    await db.ref(`users/${uid}`).update({ walletBalance: 0 });
    await db.ref('transactions').push().set({
      userId: uid,
      type: 'ADMIN_CLEAR',
      amount: prev,
      description: `Wallet cleared by admin (was ₹${prev})`,
      createdAt: Date.now(),
    });
    res.json({ message: `Wallet cleared. ₹${prev} removed.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clear admin wallet to zero
router.post('/wallet/clear', async (req, res) => {
  try {
    const snap = await db.ref('adminWallet').get();
    const prev = snap.exists() ? snap.val().balance || 0 : 0;
    await db.ref('adminWallet').set({ balance: 0 });
    await db.ref('adminTransactions').push().set({
      type: 'ADMIN_CLEAR',
      amount: prev,
      description: `Admin wallet manually cleared (was ₹${prev})`,
      createdAt: Date.now(),
    });
    res.json({ message: `Admin wallet cleared. ₹${prev} removed.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all transactions
router.get('/transactions', async (req, res) => {
  try {
    const snap = await db.ref('transactions').get();
    if (!snap.exists()) return res.json([]);
    const txns = await Promise.all(
      Object.entries(snap.val()).map(async ([id, data]) => {
        const userSnap = await db.ref(`users/${data.userId}`).get();
        const user = userSnap.exists() ? { name: userSnap.val().name, email: userSnap.val().email } : null;
        return { id, ...data, user };
      })
    );
    txns.sort((a, b) => b.createdAt - a.createdAt);
    res.json(txns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all contests with user info
router.get('/contests', async (req, res) => {
  try {
    const snap = await db.ref('contests').get();
    if (!snap.exists()) return res.json([]);
    const contests = await Promise.all(
      Object.entries(snap.val()).map(async ([id, data]) => {
        const [userSnap, matchSnap] = await Promise.all([
          db.ref(`users/${data.userId}`).get(),
          db.ref(`matches/${data.matchId}`).get(),
        ]);
        return {
          id, ...data,
          user: userSnap.exists() ? { name: userSnap.val().name, email: userSnap.val().email } : null,
          match: matchSnap.exists() ? { id: matchSnap.key, ...matchSnap.val() } : null,
        };
      })
    );
    contests.sort((a, b) => b.createdAt - a.createdAt);
    res.json(contests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get pending deposits (for admin approval)
router.get('/deposits', async (req, res) => {
  try {
    const snap = await db.ref('pendingDeposits').get();
    if (!snap.exists()) return res.json([]);
    const deposits = await Promise.all(
      Object.entries(snap.val()).map(async ([id, data]) => {
        const userSnap = await db.ref(`users/${data.userId}`).get();
        return { id, ...data, user: userSnap.exists() ? { name: userSnap.val().name, email: userSnap.val().email } : null };
      })
    );
    deposits.sort((a, b) => b.createdAt - a.createdAt);
    res.json(deposits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Approve deposit — credit user wallet
router.post('/deposits/:txnRef/approve', async (req, res) => {
  try {
    const snap = await db.ref(`pendingDeposits/${req.params.txnRef}`).get();
    if (!snap.exists()) return res.status(404).json({ message: 'Deposit not found' });
    const deposit = snap.val();
    if (deposit.status === 'APPROVED') return res.status(400).json({ message: 'Already approved' });

    const userSnap = await db.ref(`users/${deposit.userId}`).get();
    const newBalance = (userSnap.val().walletBalance || 0) + deposit.amount;
    await db.ref(`users/${deposit.userId}`).update({ walletBalance: newBalance });
    await db.ref(`pendingDeposits/${req.params.txnRef}`).update({ status: 'APPROVED', approvedAt: Date.now() });

    await db.ref('transactions').push().set({
      userId: deposit.userId,
      type: 'DEPOSIT',
      amount: deposit.amount,
      description: `Wallet top-up approved (UTR: ${deposit.utrNumber || 'N/A'})`,
      createdAt: Date.now(),
    });

    res.json({ message: `₹${deposit.amount} credited to user wallet` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reject deposit
router.post('/deposits/:txnRef/reject', async (req, res) => {
  try {
    await db.ref(`pendingDeposits/${req.params.txnRef}`).update({ status: 'REJECTED', rejectedAt: Date.now() });
    res.json({ message: 'Deposit rejected' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all withdrawal requests
router.get('/withdrawals', async (req, res) => {
  try {
    const snap = await db.ref('withdrawals').get();
    if (!snap.exists()) return res.json([]);
    const list = await Promise.all(
      Object.entries(snap.val()).map(async ([id, data]) => {
        const userSnap = await db.ref(`users/${data.userId}`).get();
        return { id, ...data, user: userSnap.exists() ? { name: userSnap.val().name, phone: userSnap.val().phone, email: userSnap.val().email } : null };
      })
    );
    list.sort((a, b) => b.createdAt - a.createdAt);
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Approve withdrawal — mark as paid
router.post('/withdrawals/:id/approve', async (req, res) => {
  try {
    const snap = await db.ref(`withdrawals/${req.params.id}`).get();
    if (!snap.exists()) return res.status(404).json({ message: 'Not found' });
    const w = snap.val();
    if (w.status !== 'PENDING') return res.status(400).json({ message: 'Already processed' });

    await db.ref(`withdrawals/${req.params.id}`).update({ status: 'APPROVED', approvedAt: Date.now() });

    await db.ref('adminTransactions').push().set({
      type: 'WITHDRAWAL_PAID',
      userId: w.userId,
      amount: w.amount,
      description: `Withdrawal paid via ${w.method?.toUpperCase()} to ${w.upiId || w.accountNumber}`,
      createdAt: Date.now(),
    });

    res.json({ message: `₹${w.amount} withdrawal approved` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reject withdrawal — refund user wallet
router.post('/withdrawals/:id/reject', async (req, res) => {
  try {
    const snap = await db.ref(`withdrawals/${req.params.id}`).get();
    if (!snap.exists()) return res.status(404).json({ message: 'Not found' });
    const w = snap.val();
    if (w.status !== 'PENDING') return res.status(400).json({ message: 'Already processed' });

    // Refund
    const userSnap = await db.ref(`users/${w.userId}`).get();
    const newBal = (userSnap.val().walletBalance || 0) + w.amount;
    await db.ref(`users/${w.userId}`).update({ walletBalance: newBal });
    await db.ref(`withdrawals/${req.params.id}`).update({ status: 'REJECTED', rejectedAt: Date.now() });

    await db.ref('transactions').push().set({
      userId: w.userId,
      type: 'WITHDRAWAL_REFUND',
      amount: w.amount,
      description: 'Withdrawal rejected — amount refunded to wallet',
      createdAt: Date.now(),
    });

    res.json({ message: `₹${w.amount} refunded to user wallet` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/contests/:id/payout', async (req, res) => {
  try {
    const contestSnap = await db.ref(`contests/${req.params.id}`).get();
    if (!contestSnap.exists()) return res.status(404).json({ message: 'Contest not found' });
    const contest = contestSnap.val();
    if (contest.status !== 'WON') return res.status(400).json({ message: 'Contest not won' });
    if (!contest.pendingPayout) return res.status(400).json({ message: 'Already paid out' });

    // Credit user wallet regardless of admin balance — admin handles the actual transfer manually
    const userSnap = await db.ref(`users/${contest.userId}`).get();
    const newBal = (userSnap.val().walletBalance || 0) + contest.winnings;
    await db.ref(`users/${contest.userId}`).update({ walletBalance: newBal });
    await db.ref(`contests/${req.params.id}`).update({ pendingPayout: false });

    // Deduct from admin wallet (can go negative — admin must top up)
    const adminSnap = await db.ref('adminWallet').get();
    const adminBalance = adminSnap.exists() ? (adminSnap.val().balance || 0) : 0;
    await db.ref('adminWallet').set({ balance: adminBalance - contest.winnings });

    await db.ref('transactions').push().set({
      userId: contest.userId,
      type: 'WINNINGS',
      amount: contest.winnings,
      description: 'Manual payout by admin',
      createdAt: Date.now(),
    });
    await db.ref('adminTransactions').push().set({
      type: 'PAYOUT',
      userId: contest.userId,
      amount: contest.winnings,
      description: `Manual payout to winner`,
      createdAt: Date.now(),
    });

    res.json({ message: 'Payout successful', amount: contest.winnings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
