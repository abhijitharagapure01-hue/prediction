import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const TIERS = [10, 50, 100, 500, 1000];

export default function MatchDetails() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [slots, setSlots] = useState([]);
  const [myContests, setMyContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAll = async () => {
    const [matchRes, slotsRes] = await Promise.all([
      api.get(`/matches/${id}`),
      api.get(`/contests/slots/${id}`),
    ]);
    setMatch(matchRes.data);
    setSlots(slotsRes.data.tiers);
    if (user) {
      const myRes = await api.get('/contests/my');
      setMyContests(myRes.data.filter((c) => (c.matchId?.id || c.matchId) === id));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id, user]);

  const myTiers = myContests.map((c) => c.amount);

  const handleJoin = async () => {
    if (!user) return navigate('/login');
    if (!selectedTeam) return setError('Select a team');
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/contests/join', { matchId: id, selectedTeam, betAmount: selectedTier });
      await refreshUser();
      setSuccess(`Joined Slot #${data.slotNumber} for ₹${selectedTier} — picked ${selectedTeam}`);
      setSelectedTier(null);
      setSelectedTeam('');
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-gray-500 p-4">Loading...</p>;
  if (!match) return <p className="text-red-400 p-4">Match not found.</p>;

  const teamAOdds = match.teamAOdds || 1.9;
  const teamBOdds = match.teamBOdds || 1.9;
  const selectedOdds = selectedTeam === match.teamA ? teamAOdds : selectedTeam === match.teamB ? teamBOdds : null;
  const prize = selectedTier && selectedOdds ? Math.floor(selectedTier * selectedOdds) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Match header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
        <h2 className="text-2xl font-bold">{match.teamA} <span className="text-gray-500">vs</span> {match.teamB}</h2>
        <p className="text-gray-400 text-sm mt-1">{new Date(match.startTime).toLocaleString()}</p>
        <span className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${
          match.status === 'UPCOMING' ? 'bg-blue-900 text-blue-300' :
          match.status === 'LOCKED' ? 'bg-yellow-900 text-yellow-300' :
          'bg-gray-700 text-gray-300'
        }`}>{match.status}</span>
        <div className="flex justify-center gap-8 mt-3 text-sm">
          <span className="text-gray-400">{match.teamA}: <span className="text-green-400 font-bold">{teamAOdds}x</span></span>
          <span className="text-gray-400">{match.teamB}: <span className="text-yellow-400 font-bold">{teamBOdds}x</span></span>
        </div>
        {match.status === 'COMPLETED' && match.winningTeam && (
          <div className="mt-3 bg-green-900/30 border border-green-700 rounded-xl p-3">
            <p className="text-green-400 font-semibold">Winner: {match.winningTeam}</p>
          </div>
        )}
      </div>

      {success && (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-3 text-green-400 text-sm">{success}</div>
      )}

      {/* Slot tiers */}
      {match.status === 'UPCOMING' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-300">Choose a Slot</h3>
          {slots.map((tier) => {
            const alreadyJoined = myTiers.includes(tier.amount);
            const allFull = tier.openSlotNumber === null;
            const isSelected = selectedTier === tier.amount;
            const myEntry = myContests.find((c) => c.amount === tier.amount);
            const filledSlots = tier.slots.filter((s) => s.full).length;
            const openSlot = tier.slots.find((s) => !s.full);

            return (
              <div key={tier.amount} className={`bg-gray-900 border rounded-2xl p-4 transition-colors ${
                isSelected ? 'border-yellow-500' : 'border-gray-800'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-yellow-400">₹{tier.amount}</span>
                    <span className="text-xs text-gray-500">Win up to ₹{Math.floor(tier.amount * Math.max(teamAOdds, teamBOdds))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {alreadyJoined && (
                      <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded-full">Joined ✓</span>
                    )}
                    {allFull && !alreadyJoined && (
                      <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded-full">Full</span>
                    )}
                    <span className="text-xs text-gray-500">{filledSlots}/10 slots filled</span>
                  </div>
                </div>

                {/* Slot progress bar */}
                <div className="flex gap-1 mb-3">
                  {tier.slots.map((s) => (
                    <div key={s.slotNumber} className={`flex-1 h-2 rounded-full ${
                      s.full ? 'bg-green-600' :
                      (s.teamAFilled || s.teamBFilled) ? 'bg-yellow-600' :
                      'bg-gray-700'
                    }`} title={`Slot ${s.slotNumber}: ${s.full ? 'Full' : s.teamAFilled ? `${match.teamA} joined` : s.teamBFilled ? `${match.teamB} joined` : 'Open'}`} />
                  ))}
                </div>

                {/* Open slot info */}
                {openSlot && !alreadyJoined && (
                  <div className="text-xs text-gray-400 mb-3 flex gap-4">
                    <span>Slot #{openSlot.slotNumber} open:</span>
                    <span className={openSlot.teamAFilled ? 'text-gray-500 line-through' : 'text-green-400'}>{match.teamA} {openSlot.teamAFilled ? '✓' : 'available'}</span>
                    <span className={openSlot.teamBFilled ? 'text-gray-500 line-through' : 'text-green-400'}>{match.teamB} {openSlot.teamBFilled ? '✓' : 'available'}</span>
                  </div>
                )}

                {/* My entry info */}
                {myEntry && (
                  <div className="bg-gray-800 rounded-xl p-3 text-sm">
                    <p className="text-gray-300">Your pick: <span className="text-white font-semibold">{myEntry.selectedTeam}</span> — Slot #{myEntry.slotNumber}</p>
                    <p className={`font-bold mt-1 ${myEntry.status === 'WON' ? 'text-green-400' : myEntry.status === 'LOST' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {myEntry.status}{myEntry.status === 'WON' ? ` — Won ₹${myEntry.winnings}` : ''}
                    </p>
                  </div>
                )}

                {/* Join button */}
                {!alreadyJoined && !allFull && (
                  <button onClick={() => { setSelectedTier(tier.amount); setSelectedTeam(''); setError(''); setSuccess(''); }}
                    className={`w-full mt-2 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      isSelected ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                    }`}>
                    {isSelected ? 'Selected ✓' : `Join ₹${tier.amount} Slot`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Team selection panel */}
      {selectedTier && match.status === 'UPCOMING' && (
        <div className="bg-gray-900 border border-yellow-600 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Pick your team — ₹{selectedTier} slot</h3>
            <button onClick={() => { setSelectedTier(null); setSelectedTeam(''); setError(''); }}
              className="text-gray-500 hover:text-white text-sm">✕ Cancel</button>
          </div>

          {/* Which sides are available in open slot */}
          {(() => {
            const tier = slots.find((t) => t.amount === selectedTier);
            const openSlot = tier?.slots.find((s) => !s.full);
            const teamAAvailable = openSlot && !openSlot.teamAFilled;
            const teamBAvailable = openSlot && !openSlot.teamBFilled;
            return (
              <div className="grid grid-cols-2 gap-3">
                {[match.teamA, match.teamB].map((team) => {
                  const odds = team === match.teamA ? teamAOdds : teamBOdds;
                  const available = team === match.teamA ? teamAAvailable : teamBAvailable;
                  return (
                    <button key={team} disabled={!available}
                      onClick={() => available && setSelectedTeam(team)}
                      className={`py-4 rounded-xl font-semibold transition-colors border-2 text-sm ${
                        !available ? 'border-gray-800 bg-gray-800 text-gray-600 cursor-not-allowed' :
                        selectedTeam === team ? 'border-green-500 bg-green-900/40 text-green-300' :
                        'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
                      }`}>
                      <p>{team}</p>
                      <p className="text-xs mt-1 opacity-70">{odds}x • Win ₹{Math.floor(selectedTier * odds)}</p>
                      {!available && <p className="text-xs mt-1 text-red-400">Taken</p>}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {selectedTeam && (
            <div className="bg-gray-800 rounded-xl p-3 text-sm flex justify-between">
              <span className="text-gray-400">You pay:</span>
              <span className="font-bold">₹{selectedTier}</span>
              <span className="text-gray-400">If you win:</span>
              <span className="text-green-400 font-bold">₹{prize}</span>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleJoin} disabled={!selectedTeam || submitting}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-colors">
            {submitting ? 'Joining...' : `Confirm — Pay ₹${selectedTier}`}
          </button>
          {user && <p className="text-center text-xs text-gray-500">Wallet: ₹{user.walletBalance}</p>}
        </div>
      )}

      {/* Locked / Completed state */}
      {match.status !== 'UPCOMING' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-300 mb-3">Your Entries</h3>
          {myContests.length === 0 ? (
            <p className="text-gray-500 text-sm">You didn't join any slots for this match.</p>
          ) : myContests.map((c) => (
            <div key={c.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0 text-sm">
              <div>
                <p className="font-medium">{c.selectedTeam} — Slot #{c.slotNumber}</p>
                <p className="text-gray-500 text-xs">₹{c.amount} entry</p>
              </div>
              <p className={`font-bold ${c.status === 'WON' ? 'text-green-400' : c.status === 'LOST' ? 'text-red-400' : 'text-yellow-400'}`}>
                {c.status}{c.status === 'WON' ? ` +₹${c.winnings}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
