const cron = require('node-cron');
const { db } = require('../config/firebase');

// Refund incomplete slots when match locks
// A slot is incomplete if only 1 of the 2 sides (teamA or teamB) joined
const refundIncompleteSlots = async (matchId, match) => {
  const snap = await db.ref('contests').orderByChild('matchId').equalTo(matchId).get();
  if (!snap.exists()) return;

  const contests = Object.entries(snap.val()).map(([id, d]) => ({ id, ...d }));
  const SLOT_TIERS = [10, 50, 100, 500, 1000];

  for (const amount of SLOT_TIERS) {
    const tierContests = contests.filter((c) => c.amount === amount && c.status === 'PENDING');

    // Group by slot number
    const slotMap = {};
    for (const c of tierContests) {
      if (!slotMap[c.slotNumber]) slotMap[c.slotNumber] = [];
      slotMap[c.slotNumber].push(c);
    }

    for (const [slotNum, slotContests] of Object.entries(slotMap)) {
      const teamAFilled = slotContests.some((c) => c.selectedTeam === match.teamA);
      const teamBFilled = slotContests.some((c) => c.selectedTeam === match.teamB);

      // Incomplete slot — only one side joined
      if (!(teamAFilled && teamBFilled)) {
        for (const c of slotContests) {
          // Refund user
          const userSnap = await db.ref(`users/${c.userId}`).get();
          const bal = userSnap.val().walletBalance || 0;
          await db.ref(`users/${c.userId}`).update({ walletBalance: bal + c.amount });

          // Deduct from admin wallet
          const adminSnap = await db.ref('adminWallet').get();
          const adminBal = adminSnap.exists() ? (adminSnap.val().balance || 0) : 0;
          await db.ref('adminWallet').set({ balance: Math.max(0, adminBal - c.amount) });

          // Mark as refunded
          await db.ref(`contests/${c.id}`).update({ status: 'REFUNDED', winnings: 0 });

          // Log transaction
          await db.ref('transactions').push().set({
            userId: c.userId,
            type: 'REFUND',
            amount: c.amount,
            description: `Refund — Slot #${slotNum} (₹${c.amount}) incomplete when ${match.teamA} vs ${match.teamB} locked`,
            createdAt: Date.now(),
          });
        }
      }
    }
  }
};

const startCronJobs = () => {
  cron.schedule('* * * * *', async () => {
    const now = Date.now();
    const snap = await db.ref('matches').get();
    if (!snap.exists()) return;

    const entries = Object.entries(snap.val() || {});
    for (const [key, match] of entries) {
      if (match.status === 'UPCOMING' && match.startTime && match.startTime <= now) {
        await db.ref(`matches/${key}`).update({ status: 'LOCKED' });
        // Refund any incomplete slots
        await refundIncompleteSlots(key, match);
      } else if (match.status === 'LOCKED' && match.endTime && match.endTime <= now) {
        await db.ref(`matches/${key}`).update({ status: 'COMPLETED' });
      }
    }
  });

  console.log('Cron jobs started');
};

module.exports = { startCronJobs };
