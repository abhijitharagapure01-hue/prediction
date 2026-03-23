const router = require('express').Router();
const { db } = require('../config/firebase');
const { auth } = require('../middleware/auth');

// Slot tiers available per match
const SLOT_TIERS = [10, 50, 100, 500, 1000];
const SLOTS_PER_TIER = 10; // 10 slots per tier, each slot needs 1 teamA + 1 teamB

// Get slots status for a match
router.get('/slots/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const matchSnap = await db.ref(`matches/${matchId}`).get();
    if (!matchSnap.exists()) return res.status(404).json({ message: 'Match not found' });
    const match = matchSnap.val();

    const snap = await db.ref('contests').orderByChild('matchId').equalTo(matchId).get();
    const contests = snap.exists() ? Object.entries(snap.val()).map(([id, d]) => ({ id, ...d })) : [];

    const tiers = SLOT_TIERS.map((amount) => {
      const tierContests = contests.filter((c) => c.amount === amount);
      const slots = [];

      for (let i = 1; i <= SLOTS_PER_TIER; i++) {
        const slotContests = tierContests.filter((c) => c.slotNumber === i);
        const teamAEntry = slotContests.find((c) => c.selectedTeam === match.teamA);
        const teamBEntry = slotContests.find((c) => c.selectedTeam === match.teamB);
        slots.push({
          slotNumber: i,
          teamAFilled: !!teamAEntry,
          teamBFilled: !!teamBEntry,
          full: !!teamAEntry && !!teamBEntry,
        });
      }

      // Current open slot = first slot that isn't full
      const openSlot = slots.find((s) => !s.full);

      return { amount, slots, openSlotNumber: openSlot ? openSlot.slotNumber : null };
    });

    res.json({ tiers, teamA: match.teamA, teamB: match.teamB });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Join a slot contest
router.post('/join', auth, async (req, res) => {
  try {
    const { matchId, selectedTeam, betAmount } = req.body;
    if (!matchId || !selectedTeam || !betAmount)
      return res.status(400).json({ message: 'matchId, selectedTeam and betAmount required' });

    const amount = Number(betAmount);
    if (!SLOT_TIERS.includes(amount))
      return res.status(400).json({ message: `Bet amount must be one of: ₹${SLOT_TIERS.join(', ₹')}` });

    const matchSnap = await db.ref(`matches/${matchId}`).get();
    if (!matchSnap.exists()) return res.status(404).json({ message: 'Match not found' });
    const match = matchSnap.val();

    if (match.status !== 'UPCOMING')
      return res.status(400).json({ message: 'Contest is locked or completed' });
    if (![match.teamA, match.teamB].includes(selectedTeam))
      return res.status(400).json({ message: 'Invalid team selection' });

    // Check user hasn't already joined this tier for this match
    const existing = await db.ref('contests')
      .orderByChild('userId_matchId_amount')
      .equalTo(`${req.user.id}_${matchId}_${amount}`)
      .get();
    if (existing.exists())
      return res.status(400).json({ message: `You already joined the ₹${amount} slot for this match` });

    // Check user balance
    const userSnap = await db.ref(`users/${req.user.id}`).get();
    const userBalance = userSnap.val().walletBalance || 0;
    if (userBalance < amount)
      return res.status(400).json({ message: 'Insufficient wallet balance' });

    // Find the current open slot for this tier
    const tierSnap = await db.ref('contests').orderByChild('matchId').equalTo(matchId).get();
    const tierContests = tierSnap.exists()
      ? Object.entries(tierSnap.val()).map(([id, d]) => ({ id, ...d })).filter((c) => c.amount === amount)
      : [];

    // Find open slot — first slot where this team side is not yet taken
    let assignedSlot = null;
    for (let i = 1; i <= SLOTS_PER_TIER; i++) {
      const slotContests = tierContests.filter((c) => c.slotNumber === i);
      const teamSideTaken = slotContests.find((c) => c.selectedTeam === selectedTeam);
      const slotFull = slotContests.length >= 2;
      if (!slotFull && !teamSideTaken) {
        assignedSlot = i;
        break;
      }
    }

    if (assignedSlot === null)
      return res.status(400).json({ message: `All ₹${amount} slots are full for this match` });

    // Get admin wallet
    const adminSnap = await db.ref('adminWallet').get();
    const adminBalance = adminSnap.exists() ? (adminSnap.val().balance || 0) : 0;

    // Create contest entry
    const contestRef = db.ref('contests').push();
    await contestRef.set({
      userId: req.user.id,
      matchId,
      userId_matchId: `${req.user.id}_${matchId}`,
      userId_matchId_amount: `${req.user.id}_${matchId}_${amount}`,
      selectedTeam,
      amount,
      slotNumber: assignedSlot,
      status: 'PENDING',
      winnings: 0,
      createdAt: Date.now(),
    });

    // Deduct from user, credit to admin wallet
    await db.ref(`users/${req.user.id}`).update({ walletBalance: userBalance - amount });
    await db.ref('adminWallet').set({ balance: adminBalance + amount });

    await db.ref('transactions').push().set({
      userId: req.user.id,
      type: 'ENTRY_FEE',
      amount,
      description: `Slot #${assignedSlot} (₹${amount}) — ${match.teamA} vs ${match.teamB} — picked ${selectedTeam}`,
      createdAt: Date.now(),
    });
    await db.ref('adminTransactions').push().set({
      type: 'BET_RECEIVED',
      userId: req.user.id,
      matchId,
      amount,
      description: `Slot #${assignedSlot} ₹${amount} bet — ${match.teamA} vs ${match.teamB}`,
      createdAt: Date.now(),
    });

    res.status(201).json({ contestId: contestRef.key, slotNumber: assignedSlot, walletBalance: userBalance - amount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user's contests
router.get('/my', auth, async (req, res) => {
  try {
    const snap = await db.ref('contests').orderByChild('userId').equalTo(req.user.id).get();
    if (!snap.exists()) return res.json([]);

    const contests = [];
    for (const [id, data] of Object.entries(snap.val() || {})) {
      const matchSnap = await db.ref(`matches/${data.matchId}`).get();
      contests.push({
        id, ...data,
        matchId: matchSnap.exists() ? { id: matchSnap.key, ...matchSnap.val() } : data.matchId,
      });
    }
    contests.sort((a, b) => b.createdAt - a.createdAt);
    res.json(contests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get contest count for a match
router.get('/match/:matchId', async (req, res) => {
  try {
    const snap = await db.ref('contests').orderByChild('matchId').equalTo(req.params.matchId).get();
    res.json({ count: snap.exists() ? Object.keys(snap.val()).length : 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
