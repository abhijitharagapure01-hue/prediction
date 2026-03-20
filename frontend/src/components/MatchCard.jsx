import React from 'react';
import { Link } from 'react-router-dom';

const statusColors = {
  UPCOMING: 'bg-blue-900 text-blue-300',
  LOCKED: 'bg-yellow-900 text-yellow-300',
  COMPLETED: 'bg-gray-700 text-gray-300',
};

export default function MatchCard({ match }) {
  const startTime = new Date(match.startTime);

  return (
    <Link to={`/match/${match.id}`} className="block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-green-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[match.status]}`}>
          {match.status}
        </span>
        <div className="flex gap-1">
          {match.isIPL && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-900 text-purple-300">🏏 IPL</span>
          )}
          {match.matchType && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">{match.matchType}</span>
          )}
        </div>
      </div>

      {match.series && (
        <p className="text-xs text-gray-500 mb-2 truncate">{match.series}</p>
      )}

      <div className="flex items-center justify-between my-3">
        <span className="text-base font-bold">{match.teamA}</span>
        <span className="text-gray-500 text-sm font-medium px-2">VS</span>
        <span className="text-base font-bold">{match.teamB}</span>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        {startTime.toLocaleDateString()} {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {match.venue && ` • ${match.venue}`}
      </p>

      <div className="flex items-center justify-between text-sm border-t border-gray-800 pt-3">
        <span className="text-gray-400">{match.teamA}: <span className="text-green-400 font-semibold">{match.teamAOdds || 1.9}x</span></span>
        <span className="text-xs text-gray-600">odds</span>
        <span className="text-gray-400">{match.teamB}: <span className="text-yellow-400 font-semibold">{match.teamBOdds || 1.9}x</span></span>
      </div>
    </Link>
  );
}
