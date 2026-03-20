const router = require('express').Router();
const { db } = require('../config/firebase');
const { auth } = require('../middleware/auth');

const UPI_ID = '8904197740@ybl';
const UPI_NAME = 'CricketWin';

// Generate UPI payment link
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) < 10)
      return res.status(400).json({ message: 'Minimum deposit is ₹10' });

    const amt = Number(amount);
    const txnRef = `CW${req.user.id.slice(-6).toUpperCase()}${Date.now()}`;

    const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amt}&cu=INR&tn=${encodeURIComponent('CricketWin Wallet')}&tr=${txnRef}`;

    await db.ref(`pendingDeposits/${txnRef}`).set({
      userId: req.user.id,
      amount: amt,
      txnRef,
      status: 'PENDING',
      createdAt: Date.now(),
    });

    res.json({ upiLink, txnRef, amount: amt, upiId: UPI_ID });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// User submits UTR after paying
router.post('/confirm-payment', auth, async (req, res) => {
  try {
    const { txnRef, utrNumber } = req.body;
    if (!txnRef || !utrNumber)
      return res.status(400).json({ message: 'txnRef and utrNumber required' });

    const pendingSnap = await db.ref(`pendingDeposits/${txnRef}`).get();
    if (!pendingSnap.exists())
      return res.status(404).json({ message: 'Transaction not found' });

    const pending = pendingSnap.val();
    if (pending.userId !== req.user.id)
      return res.status(403).json({ message: 'Unauthorized' });
    if (pending.status !== 'PENDING')
      return res.status(400).json({ message: 'Already processed' });

    await db.ref(`pendingDeposits/${txnRef}`).update({
      status: 'AWAITING_APPROVAL',
      utrNumber,
      submittedAt: Date.now(),
    });

    res.json({ message: 'Payment submitted for approval. Your wallet will be credited after admin verification.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Submit withdrawal request
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, method, upiId, accountNumber, ifsc, accountName } = req.body;
    const amt = Number(amount);
    if (!amt || amt < 100)
      return res.status(400).json({ message: 'Minimum withdrawal is ₹100' });
    if (!method || !['upi', 'bank'].includes(method))
      return res.status(400).json({ message: 'method must be upi or bank' });
    if (method === 'upi' && !upiId)
      return res.status(400).json({ message: 'UPI ID required' });
    if (method === 'bank' && (!accountNumber || !ifsc || !accountName))
      return res.status(400).json({ message: 'Account number, IFSC and account name required' });

    const userSnap = await db.ref(`users/${req.user.id}`).get();
    const balance = userSnap.val().walletBalance || 0;
    if (balance < amt)
      return res.status(400).json({ message: 'Insufficient wallet balance' });

    // Deduct immediately and hold
    await db.ref(`users/${req.user.id}`).update({ walletBalance: balance - amt });

    const ref = db.ref('withdrawals').push();
    await ref.set({
      userId: req.user.id,
      amount: amt,
      method,
      upiId: upiId || null,
      accountNumber: accountNumber || null,
      ifsc: ifsc || null,
      accountName: accountName || null,
      status: 'PENDING',
      createdAt: Date.now(),
    });

    await db.ref('transactions').push().set({
      userId: req.user.id,
      type: 'WITHDRAWAL_REQUEST',
      amount: amt,
      description: `Withdrawal request via ${method.toUpperCase()} — pending admin approval`,
      createdAt: Date.now(),
    });

    res.json({ message: 'Withdrawal request submitted. Will be processed within 24 hours.', id: ref.key });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user's withdrawal requests
router.get('/withdrawals', auth, async (req, res) => {
  try {
    const snap = await db.ref('withdrawals').orderByChild('userId').equalTo(req.user.id).get();
    if (!snap.exists()) return res.json([]);
    const list = Object.entries(snap.val()).map(([id, d]) => ({ id, ...d }));
    list.sort((a, b) => b.createdAt - a.createdAt);
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get transaction history
router.get('/transactions', auth, async (req, res) => {
  try {
    const snap = await db.ref('transactions').orderByChild('userId').equalTo(req.user.id).get();
    if (!snap.exists()) return res.json([]);
    const txns = Object.entries(snap.val()).map(([id, data]) => ({ id, ...data }));
    txns.sort((a, b) => b.createdAt - a.createdAt);
    res.json(txns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
