import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function MatchDetails() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [betAmount, setBetAmount] = useState('');
  const [joined, setJoined] = useState(false);
  const [joinedData, setJoinedData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/matches/${id}`).then(({ data }) => setMatch(data)).finally(() => setLoading(false));
    if (user) {
      api.get('/contests/my').then(({ data }) => {
        const existing = data.find((c) => c.matchId?.id === id || c.matchId === id);
        if (existing) {
          setJoined(true);
          setSelectedTeam(existing.selectedTeam);
          setJoinedData(existing);
        }
      });
    }
  }, [id, user]);

  const teamAOdds = match?.teamAOdds || 1.9;
  const teamBOdds = match?.teamBOdds || 1.9;
  const selectedOdds = selectedTeam === match?.teamA ? teamAOdds : selectedTeam === match?.teamB ? teamBOdds : null;
  const prize = betAmount >= 10 && selectedOdds ? Math.floor(Number(betAmount) * selectedOdds) : 0;

  const handleJoin = async () => {
    if (!user) return navigate('/login');
    if (!selectedTeam) return setError('Please select a team');
    const amount = Number(betAmount);
    if (!amount || amount < 10) return setError('Minimum bet is ₹10');
    if (amount > (user.walletBalance || 0)) return setError('Insufficient wallet balance');

    setSubmitting(true);
    setError('');
    try {
      await api.post('/contests/join', { matchId: id, selectedTeam, betAmount: amount });
      await refreshUser();
      setJoined(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!match) return <p className="text-red-400">Match not found.</p>;

  const canJoin = match.status === 'UPCOMING' && !joined;

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">{match.teamA} <span className="text-gray-500">vs</span> {match.teamB}</h2>
          {match.series && <p className="text-gray-500 text-xs mt-1">{match.series}</p>}
          <p className="text-gray-400 text-sm mt-1">
            {new Date(match.startTime).toLocaleString()}
            {match.venue && ` • ${match.venue}`}
          </p>
          <span className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${
            match.status === 'UPCOMING' ? 'bg-blue-900 text-blue-300' :
            match.status === 'LOCKED' ? 'bg-yellow-900 text-yellow-300' :
            'bg-gray-700 text-gray-300'
          }`}>{match.status}</span>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 mb-5">
          <p className="text-gray-400 text-xs mb-2">Odds</p>
          <div className="flex justify-between text-sm">
            <span>{match.teamA}: <span className="text-green-400 font-bold">{teamAOdds}x</span></span>
            <span>{match.teamB}: <span className="text-green-400 font-bold">{teamBOdds}x</span></span>
          </div>
          <p className="text-gray-500 text-xs mt-2">Lose = ₹0 returned</p>
        </div>

        {match.status === 'COMPLETED' && match.winningTeam && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 mb-4 text-center">
            <p className="text-green-400 font-semibold">Winner: {match.winningTeam}</p>
          </div>
        )}

        {joined ? (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-center space-y-1">
            <p className="text-green-400 font-semibold">You joined with: {selectedTeam}</p>
            {joinedData && (
              <>
                <p className="text-gray-400 text-sm">Bet: <span className="text-white">₹{joinedData.amount}</span></p>
                <p className="text-gray-400 text-sm">
                  Status: <span className={
                    joinedData.status === 'WON' ? 'text-green-400' :
                    joinedData.status === 'LOST' ? 'text-red-400' : 'text-yellow-400'
                  }>{joinedData.status}</span>
                </p>
                {joinedData.status === 'WON' && (
                  <p className="text-green-400 font-bold">Won: ₹{joinedData.winnings}</p>
                )}
              </>
            )}
          </div>
        ) : canJoin ? (
          <>
            <p className="text-sm text-gray-400 mb-3">Select your team:</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[match.teamA, match.teamB].map((team) => {
                const odds = team === match.teamA ? teamAOdds : teamBOdds;
                return (
                  <button key={team} onClick={() => setSelectedTeam(team)}
                    className={`py-3 rounded-xl font-semibold transition-colors border-2 text-sm ${
                      selectedTeam === team
                        ? 'border-green-500 bg-green-900/40 text-green-300'
                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                    }`}>
                    <p>{team}</p>
                    <p className="text-xs mt-1 font-normal opacity-70">{odds}x odds</p>
                  </button>
                );
              })}
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">Enter Bet Amount (min ₹10)</label>
              <input
                type="number"
                min="10"
                placeholder="e.g. 500"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
              />
              {betAmount >= 10 && selectedOdds && (
                <div className="mt-2 flex justify-between text-sm px-1">
                  <span className="text-gray-400">If you win ({selectedOdds}x):</span>
                  <span className="text-green-400 font-bold">₹{prize}</span>
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-colors"
            >
              {submitting ? 'Joining...' : `Join Contest${betAmount >= 10 ? ` — ₹${betAmount}` : ''}`}
            </button>
            {user && (
              <p className="text-center text-xs text-gray-500 mt-2">Wallet: ₹{user.walletBalance}</p>
            )}
          </>
        ) : (
          <p className="text-center text-gray-500 text-sm">
            {match.status === 'LOCKED' ? 'Contest is locked. No new entries.' : 'Contest closed.'}
          </p>
        )}
      </div>
    </div>
  );
}
