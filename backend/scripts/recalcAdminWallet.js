/**
 * Recalculates admin wallet balance from all existing contests.
 * Run once: node scripts/recalcAdminWallet.js
 */
require('dotenv').config();
const { db } = require('../config/firebase');

(async () => {
  const snap = await db.ref('contests').get();
  if (!snap.exists()) {
    console.log('No contests found');
    process.exit(0);
  }

  let total = 0;
  const adminTxns = [];

  for (const [id, contest] of Object.entries(snap.val())) {
    // Count all bets that came in (entry fees paid)
    total += contest.amount || 0;

    // If already WON and paid out, deduct the payout
    if (contest.status === 'WON' && !contest.pendingPayout) {
      total -= contest.winnings || 0;
    }

    // Log as admin transaction if not already there
    const matchSnap = await db.ref(`matches/${contest.matchId}`).get();
    const matchName = matchSnap.exists()
      ? `${matchSnap.val().teamA} vs ${matchSnap.val().teamB}`
      : contest.matchId;

    adminTxns.push({
      type: 'BET_RECEIVED',
      userId: contest.userId,
      matchId: contest.matchId,
      amount: contest.amount,
      description: `Bet received for ${matchName}`,
      createdAt: contest.createdAt || Date.now(),
    });
  }

  // Set admin wallet balance
  await db.ref('adminWallet').set({ balance: total });

  // Write admin transactions
  for (const txn of adminTxns) {
    await db.ref('adminTransactions').push().set(txn);
  }

  console.log(`Admin wallet set to ₹${total} from ${adminTxns.length} contests`);
  process.exit(0);
})();
