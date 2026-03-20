require('dotenv').config();
const { db } = require('../config/firebase');

const email = process.argv[2];
if (!email) { console.error('Usage: node scripts/makeAdmin.js <email>'); process.exit(1); }

(async () => {
  const snap = await db.ref('users').orderByChild('email').equalTo(email).get();
  if (!snap.exists()) { console.error('User not found'); process.exit(1); }
  let userId;
  snap.forEach((child) => { userId = child.key; });
  await db.ref(`users/${userId}`).update({ isAdmin: true });
  console.log(`${email} is now an admin.`);
  process.exit(0);
})();
