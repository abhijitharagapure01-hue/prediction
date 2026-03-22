const router = require('express').Router();
const { db } = require('../config/firebase');
const { auth, adminAuth } = require('../middleware/auth');

// User submits a support ticket
router.post('/ticket', auth, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject?.trim() || !message?.trim())
      return res.status(400).json({ message: 'Subject and message are required' });

    const userSnap = await db.ref(`users/${req.user.id}`).get();
    const user = userSnap.val();

    const ref = db.ref('supportTickets').push();
    await ref.set({
      userId: req.user.id,
      userName: user.name || 'Unknown',
      userEmail: user.email || '',
      subject: subject.trim(),
      message: message.trim(),
      status: 'OPEN',
      createdAt: Date.now(),
    });

    res.json({ message: 'Your issue has been submitted. Admin will respond shortly.', id: ref.key });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// User gets their own tickets
router.get('/my-tickets', auth, async (req, res) => {
  try {
    const snap = await db.ref('supportTickets').orderByChild('userId').equalTo(req.user.id).get();
    if (!snap.exists()) return res.json([]);
    const tickets = Object.entries(snap.val()).map(([id, d]) => ({ id, ...d }));
    tickets.sort((a, b) => b.createdAt - a.createdAt);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — get all tickets
router.get('/tickets', auth, adminAuth, async (req, res) => {
  try {
    const snap = await db.ref('supportTickets').get();
    if (!snap.exists()) return res.json([]);
    const tickets = Object.entries(snap.val()).map(([id, d]) => ({ id, ...d }));
    tickets.sort((a, b) => b.createdAt - a.createdAt);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — reply to a ticket
router.post('/tickets/:id/reply', auth, adminAuth, async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply?.trim()) return res.status(400).json({ message: 'Reply is required' });
    await db.ref(`supportTickets/${req.params.id}`).update({
      status: 'RESOLVED',
      adminReply: reply.trim(),
      resolvedAt: Date.now(),
    });
    res.json({ message: 'Reply sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — close ticket without reply
router.post('/tickets/:id/close', auth, adminAuth, async (req, res) => {
  try {
    await db.ref(`supportTickets/${req.params.id}`).update({ status: 'CLOSED', closedAt: Date.now() });
    res.json({ message: 'Ticket closed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
