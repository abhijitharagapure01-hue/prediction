const router = require('express').Router();
const { db } = require('../config/firebase');
const { auth } = require('../middleware/auth');

// Join a contest
router.post('/join', auth, async (req, res) => {
  try {
    const { matchId, selectedTeam, betAmount } = req.body;
    if (!matchId || !selectedTeam || !betAmount)
      return res.status(400).json({ message: 'matchId, selectedTeam and betAmount required' });

    const amount = Number(betAmount);
    if (isNaN(amount) || amount < 10)
      return res.status(400).json({ message: 'Minimum bet is ₹10' });

    const matchSnap = await db.ref(`matches/${matchId}`).get();
    if (!matchSnap.exists()) return res.status(404).json({ message: 'Match not found' });
    const match = matchSnap.val();

    if (match.status !== 'UPCOMING')
      return res.status(400).json({ message: 'Contest is locked or completed' });
    if (![match.teamA, match.teamB].includes(selectedTeam))
      return res.status(400).json({ message: 'Invalid team selection' });

    // Check already joined
    const existing = await db.ref('contests')
      .orderByChild('userId_matchId')
      .equalTo(`${req.user.id}_${matchId}`)
      .get();
    if (existing.exists()) return res.status(400).json({ message: 'Already joined this contest' });

    // Check user balance
    const userSnap = await db.ref(`users/${req.user.id}`).get();
    const userBalance = userSnap.val().walletBalance;
    if (userBalance < amount)
      return res.status(400).json({ message: 'Insufficient wallet balance' });

    // Get admin wallet
    const adminSnap = await db.ref('adminWallet').get();
    const adminBalance = adminSnap.exists() ? (adminSnap.val().balance || 0) : 0;

    // Create contest entry
    const contestRef = db.ref('contests').push();
    await contestRef.set({
      userId: req.user.id,
      matchId,
      userId_matchId: `${req.user.id}_${matchId}`,
      selectedTeam,
      amount,
      status: 'PENDING',
      winnings: 0,
      createdAt: Date.now(),
    });

    // Deduct from user, credit to admin wallet
    await db.ref(`users/${req.user.id}`).update({ walletBalance: userBalance - amount });
    await db.ref('adminWallet').set({ balance: adminBalance + amount });

    // Log transactions
    await db.ref('transactions').push().set({
      userId: req.user.id,
      type: 'ENTRY_FEE',
      amount,
      description: `Bet on ${match.teamA} vs ${match.teamB} (${selectedTeam})`,
      createdAt: Date.now(),
    });
    await db.ref('adminTransactions').push().set({
      type: 'BET_RECEIVED',
      userId: req.user.id,
      matchId,
      amount,
      description: `Bet received from user for ${match.teamA} vs ${match.teamB}`,
      createdAt: Date.now(),
    });

    res.status(201).json({ contestId: contestRef.key, walletBalance: userBalance - amount });
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
