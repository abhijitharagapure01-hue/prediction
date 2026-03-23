import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function MatchDetails() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [myContests, setMyContests] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeTier, setActiveTier] = useState(null); // which tier card is expanded
  const [selectedSlot, setSelectedSlot] = useState(null); // { slotNumber }
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
    setTiers(slotsRes.data.tiers);
    if (user) {
      const myRes = await api.get('/contests/my');
      setMyContests(myRes.data.filter((c) => (c.matchId?.id || c.matchId) === id));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id, user]);

  const handleJoin = async () => {
    if (!user) return navigate('/login');
    if (!selectedSlot) return setError('Select a slot');
    if (!selectedTeam) return setError('Select a team');
    setSubmitting(true);
    setError('');
    try {
      // Pass slotNumber so backend assigns exact slot
      const { data } = await api.post('/contests/join', {
        matchId: id,
        selectedTeam,
        betAmount: activeTier,
        slotNumber: selectedSlot,
      });
      await refreshUser();
      setSuccess(`Joined Slot #${data.slotNumber} for ₹${activeTier} — picked ${selectedTeam}`);
      setActiveTier(null);
      setSelectedSlot(null);
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

      {/* Tier cards */}
      {match.status === 'UPCOMING' && tiers.map((tier) => {
        const myEntry = myContests.find((c) => c.amount === tier.amount);
        const filledSlots = tier.slots.filter((s) => s.full).length;
        const isOpen = activeTier === tier.amount;

        // Sort slots: my slot first, then half-filled, then empty, then full
        const sortedSlots = [...tier.slots].sort((a, b) => {
          const mySlotNum = myEntry?.slotNumber;
          if (a.slotNumber === mySlotNum) return -1;
          if (b.slotNumber === mySlotNum) return 1;
          const aHalf = (a.teamAFilled || a.teamBFilled) && !a.full;
          const bHalf = (b.teamAFilled || b.teamBFilled) && !b.full;
          if (aHalf && !bHalf) return -1;
          if (!aHalf && bHalf) return 1;
          if (!a.full && b.full) return -1;
          if (a.full && !b.full) return 1;
          return a.slotNumber - b.slotNumber;
        });

        return (
          <div key={tier.amount} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Tier header — click to expand */}
            <button
              onClick={() => { setActiveTier(isOpen ? null : tier.amount); setSelectedSlot(null); setSelectedTeam(''); setError(''); setSuccess(''); }}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-yellow-400">₹{tier.amount}</span>
                <span className="text-xs text-gray-500">Win up to ₹{Math.floor(tier.amount * Math.max(teamAOdds, teamBOdds))}</span>
                {myEntry && <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">Joined ✓</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{filledSlots}/10 full</span>
                <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Expanded slot list */}
            {isOpen && (
              <div className="border-t border-gray-800 p-4 space-y-2">
                {sortedSlots.map((slot) => {
                  const isMySlot = myEntry?.slotNumber === slot.slotNumber;
                  const isSelected = selectedSlot === slot.slotNumber;
                  const half = (slot.teamAFilled || slot.teamBFilled) && !slot.full;

                  return (
                    <div key={slot.slotNumber}>
                      {/* Slot row */}
                      <button
                        onClick={() => {
                          if (isMySlot) return; // already joined, just show info
                          setSelectedSlot(isSelected ? null : slot.slotNumber);
                          setSelectedTeam('');
                          setError('');
                        }}
                        className={`w-full rounded-xl p-3 flex items-center justify-between transition-colors border ${
                          isMySlot ? 'border-green-700 bg-green-900/20 cursor-default' :
                          isSelected ? 'border-yellow-500 bg-yellow-900/20' :
                          slot.full ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-default' :
                          half ? 'border-blue-700 bg-blue-900/10 hover:bg-blue-900/20' :
                          'border-gray-700 bg-gray-800 hover:bg-gray-700'
                        }`}>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-300">Slot #{slot.slotNumber}</span>
                          {isMySlot && <span className="text-xs text-green-400 font-medium">Your slot</span>}
                          {half && !isMySlot && <span className="text-xs text-blue-400">1 joined</span>}
                          {slot.full && !isMySlot && <span className="text-xs text-gray-500">Full</span>}
                          {!slot.teamAFilled && !slot.teamBFilled && !isMySlot && <span className="text-xs text-gray-500">Empty</span>}
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className={slot.teamAFilled ? 'text-green-400' : 'text-gray-600'}>{match.teamA} {slot.teamAFilled ? '✓' : '○'}</span>
                          <span className={slot.teamBFilled ? 'text-green-400' : 'text-gray-600'}>{match.teamB} {slot.teamBFilled ? '✓' : '○'}</span>
                        </div>
                      </button>

                      {/* My entry detail */}
                      {isMySlot && (
                        <div className="mt-1 px-3 py-2 bg-gray-800 rounded-xl text-xs text-gray-300 flex justify-between">
                          <span>Picked: <span className="text-white font-semibold">{myEntry.selectedTeam}</span></span>
                          <span className={myEntry.status === 'WON' ? 'text-green-400 font-bold' : myEntry.status === 'LOST' ? 'text-red-400' : myEntry.status === 'REFUNDED' ? 'text-blue-400' : 'text-yellow-400'}>
                            {myEntry.status}{myEntry.status === 'WON' ? ` +₹${myEntry.winnings}` : myEntry.status === 'REFUNDED' ? ` +₹${myEntry.amount}` : ''}
                          </span>
                        </div>
                      )}

                      {/* Team picker for selected slot */}
                      {isSelected && !slot.full && !isMySlot && (
                        <div className="mt-2 space-y-2 px-1">
                          <p className="text-xs text-gray-400">Pick your team for Slot #{slot.slotNumber}:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {[match.teamA, match.teamB].map((team) => {
                              const odds = team === match.teamA ? teamAOdds : teamBOdds;
                              const taken = team === match.teamA ? slot.teamAFilled : slot.teamBFilled;
                              return (
                                <button key={team}
                                  onClick={() => !taken && setSelectedTeam(team)}
                                  disabled={taken}
                                  className={`py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                                    taken ? 'border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed' :
                                    selectedTeam === team ? 'border-green-500 bg-green-900/40 text-green-300' :
                                    'border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-300'
                                  }`}>
                                  <p>{team}</p>
                                  <p className="text-xs mt-0.5 opacity-70">{odds}x • ₹{Math.floor(tier.amount * odds)}</p>
                                  {taken && <p className="text-xs text-red-400 mt-0.5">Taken</p>}
                                </button>
                              );
                            })}
                          </div>
                          {selectedTeam && (
                            <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2 text-sm">
                              <span className="text-gray-400">Pay ₹{tier.amount}</span>
                              <span className="text-green-400 font-bold">Win ₹{Math.floor(tier.amount * (selectedTeam === match.teamA ? teamAOdds : teamBOdds))}</span>
                            </div>
                          )}
                          {error && <p className="text-red-400 text-xs">{error}</p>}
                          <button onClick={handleJoin} disabled={!selectedTeam || submitting}
                            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-colors text-sm">
                            {submitting ? 'Joining...' : `Confirm — Pay ₹${tier.amount}`}
                          </button>
                          {user && <p className="text-center text-xs text-gray-500">Wallet: ₹{user.walletBalance}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Locked / Completed entries */}
      {match.status !== 'UPCOMING' && myContests.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-300 mb-3">Your Entries</h3>
          {myContests.map((c) => (
            <div key={c.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0 text-sm">
              <div>
                <p className="font-medium">{c.selectedTeam} — Slot #{c.slotNumber}</p>
                <p className="text-gray-500 text-xs">₹{c.amount} entry</p>
              </div>
              <p className={`font-bold ${c.status === 'WON' ? 'text-green-400' : c.status === 'LOST' ? 'text-red-400' : c.status === 'REFUNDED' ? 'text-blue-400' : 'text-yellow-400'}`}>
                {c.status}{c.status === 'WON' ? ` +₹${c.winnings}` : c.status === 'REFUNDED' ? ` +₹${c.amount}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
