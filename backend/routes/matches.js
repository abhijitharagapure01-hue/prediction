const router = require('express').Router();
const { db } = require('../config/firebase');

// Get all matches
router.get('/', async (req, res) => {
  try {
    const snap = await db.ref('matches').get();
    if (!snap.exists()) return res.json([]);

    // Use Object.entries instead of snap.forEach — forEach has a known issue
    // where it stops early if any child key causes ordering conflicts
    const val = snap.val();
    let matches = Object.entries(val).map(([id, data]) => ({ id, ...data }));

    if (req.query.status) {
      matches = matches.filter((m) => m.status === req.query.status);
    }

    // Sort: UPCOMING first, then LOCKED, then COMPLETED; within each by startTime
    const order = { UPCOMING: 0, LOCKED: 1, COMPLETED: 2 };
    matches.sort((a, b) => {
      const sd = (order[a.status] ?? 3) - (order[b.status] ?? 3);
      return sd !== 0 ? sd : (a.startTime || 0) - (b.startTime || 0);
    });

    console.log(`[matches] returning ${matches.length}`);
    res.json(matches);
  } catch (err) {
    console.error('[matches] error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Get single match
router.get('/:id', async (req, res) => {
  try {
    const snap = await db.ref(`matches/${req.params.id}`).get();
    if (!snap.exists()) return res.status(404).json({ message: 'Match not found' });
    res.json({ id: snap.key, ...snap.val() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
