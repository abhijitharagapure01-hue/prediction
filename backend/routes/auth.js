const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, admin } = require('../config/firebase');
const { auth } = require('../middleware/auth');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const safeUser = (id, data) => ({
  id,
  name: data.name,
  email: data.email || null,
  phone: data.phone || null,
  walletBalance: data.walletBalance ?? 0,
  isAdmin: data.isAdmin ?? false,
});

// Register with email/password
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields required' });

    const snap = await db.ref('users').orderByChild('email').equalTo(email).get();
    if (snap.exists()) return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const ref = db.ref('users').push();
    await ref.set({ name, email, password: hashed, walletBalance: 0, isAdmin: false, createdAt: Date.now() });

    const user = (await ref.get()).val();
    res.status(201).json({ token: signToken(ref.key), user: safeUser(ref.key, user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const snap = await db.ref('users').orderByChild('email').equalTo(email).get();
    if (!snap.exists()) return res.status(400).json({ message: 'Invalid credentials' });

    let userId, userData;
    snap.forEach((child) => { userId = child.key; userData = child.val(); });

    const valid = await bcrypt.compare(password, userData.password);
    if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

    res.json({ token: signToken(userId), user: safeUser(userId, userData) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login / Register with Firebase phone OTP (frontend verifies OTP, sends idToken here)
router.post('/phone-auth', async (req, res) => {
  try {
    const { idToken, name } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken required' });

    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone) return res.status(400).json({ message: 'Phone number not found in token' });

    // Check if user exists by phone
    const snap = await db.ref('users').orderByChild('phone').equalTo(phone).get();

    let userId, userData;
    if (snap.exists()) {
      snap.forEach((child) => { userId = child.key; userData = child.val(); });
    } else {
      // New user — register
      if (!name) return res.status(400).json({ message: 'Name required for new registration' });
      const ref = db.ref('users').push();
      await ref.set({ name, phone, walletBalance: 0, isAdmin: false, createdAt: Date.now() });
      userId = ref.key;
      userData = (await ref.get()).val();
    }

    res.json({ token: signToken(userId), user: safeUser(userId, userData) });
  } catch (err) {
    if (err.code === 'auth/id-token-expired') return res.status(401).json({ message: 'OTP session expired. Please try again.' });
    res.status(500).json({ message: err.message });
  }
});

// Get current user
router.get('/me', auth, (req, res) => {
  res.json({ user: safeUser(req.user.id, req.user) });
});

module.exports = router;
