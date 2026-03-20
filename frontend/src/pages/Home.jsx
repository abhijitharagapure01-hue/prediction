import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import MatchCard from '../components/MatchCard';

const TABS = ['ALL', 'UPCOMING', 'LOCKED', 'COMPLETED'];

export default function Home() {
  const [allMatches, setAllMatches] = useState([]);
  const [tab, setTab] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMatches = useCallback(async () => {
    try {
      const { data } = await api.get('/matches');
      setAllMatches(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError('Could not load matches.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 15000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  // Filter in frontend — no separate API call per tab
  const matches = tab === 'ALL'
    ? allMatches
    : allMatches.filter(m => m.status === tab);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Cricket Matches</h1>
        <button onClick={fetchMatches} className="text-gray-500 hover:text-white text-sm">🔄 Refresh</button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            {t}
            {t !== 'ALL' && allMatches.filter(m => m.status === t).length > 0 && (
              <span className="ml-1 text-xs opacity-70">
                ({allMatches.filter(m => m.status === t).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-40 animate-pulse" />)}
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">🏏</p>
          <p>No {tab !== 'ALL' ? tab.toLowerCase() + ' ' : ''}matches found.</p>
          {tab !== 'ALL' && (
            <button onClick={() => setTab('ALL')} className="mt-2 text-xs text-green-400 hover:underline">
              View all ({allMatches.length})
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((m) => <MatchCard key={m.id} match={m} />)}
        </div>
      )}
    </div>
  );
}
