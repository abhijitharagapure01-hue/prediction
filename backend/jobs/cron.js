const cron = require('node-cron');
const { db } = require('../config/firebase');

const startCronJobs = () => {
  cron.schedule('* * * * *', async () => {
    const now = Date.now();
    const snap = await db.ref('matches').get();
    if (!snap.exists()) return;

    // Use Object.entries — snap.forEach has a bug returning only 1 child
    const entries = Object.entries(snap.val() || {});
    for (const [key, match] of entries) {
      if (match.status === 'UPCOMING' && match.startTime && match.startTime <= now) {
        await db.ref(`matches/${key}`).update({ status: 'LOCKED' });
      } else if (match.status === 'LOCKED' && match.endTime && match.endTime <= now) {
        await db.ref(`matches/${key}`).update({ status: 'COMPLETED' });
      }
    }
  });

  console.log('Cron jobs started');
};

module.exports = { startCronJobs };
