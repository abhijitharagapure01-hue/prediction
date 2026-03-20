const { db } = require('../config/firebase');

/**
 * Distribute winnings based on per-team odds set by admin.
 * e.g. teamAOdds=1.5 means bet ₹100 on Team A and win → get ₹150
 * Losers get ₹0, money stays in admin wallet.
 */
const distributeWinnings = async (match, matchId) => {
  const snap = await db.ref('contests').orderByChild('matchId').equalTo(matchId).get();
  if (!snap.exists()) return { winners: 0, losers: 0, totalPaid: 0, adminProfit: 0 };

  const adminSnap = await db.ref('adminWallet').get();
  let adminBalance = adminSnap.exists() ? (adminSnap.val().balance || 0) : 0;

  let winners = 0, losers = 0, totalPaid = 0, totalLost = 0;

  // Normalize for comparison — trim + lowercase to avoid mismatch from admin typos
  const normalize = (s) => (s || '').trim().toLowerCase();
  const winningTeamNorm = normalize(match.winningTeam);
  const teamANorm = normalize(match.teamA);

  for (const [id, data] of Object.entries(snap.val())) {
    if (data.status !== 'PENDING') continue;

    const selectedNorm = normalize(data.selectedTeam);

    // Get odds for the selected team
    const odds = selectedNorm === teamANorm
      ? (match.teamAOdds || 1.9)
      : (match.teamBOdds || 1.9);

    const prize = Math.floor(data.amount * odds);

    if (selectedNorm === winningTeamNorm) {
      // Always pay winner — don't block on admin wallet balance
      await db.ref(`contests/${id}`).update({ status: 'WON', winnings: prize, pendingPayout: false });

      const userSnap = await db.ref(`users/${data.userId}`).get();
      await db.ref(`users/${data.userId}`).update({
        walletBalance: (userSnap.val().walletBalance || 0) + prize,
      });

      adminBalance -= prize;
      await db.ref('adminWallet').set({ balance: adminBalance });

      await db.ref('transactions').push().set({
        userId: data.userId,
        type: 'WINNINGS',
        amount: prize,
        description: `Won bet on ${match.teamA} vs ${match.teamB} (odds: ${odds}x)`,
        createdAt: Date.now(),
      });
      await db.ref('adminTransactions').push().set({
        type: 'PAYOUT',
        userId: data.userId,
        matchId,
        amount: prize,
        description: `Payout to winner — ${match.teamA} vs ${match.teamB}`,
        createdAt: Date.now(),
      });

      winners++;
      totalPaid += prize;
    } else {
      await db.ref(`contests/${id}`).update({ status: 'LOST', winnings: 0 });
      totalLost += data.amount;
      losers++;
    }
  }

  return { winners, losers, totalPaid, adminProfit: totalLost };
};

module.exports = { distributeWinnings };
