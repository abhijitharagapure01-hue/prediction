const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const snap = await db.ref(`users/${decoded.id}`).get();
    if (!snap.exists()) return res.status(401).json({ message: 'User not found' });
    req.user = { id: decoded.id, ...snap.val() };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const adminAuth = (req, res, next) => {
  if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  next();
};

module.exports = { auth, adminAuth };
