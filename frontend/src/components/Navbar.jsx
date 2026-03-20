import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-green-400">🏏 CricketWin</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/" className="hover:text-green-400 transition-colors">Matches</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="hover:text-green-400 transition-colors">Dashboard</Link>
              {user.isAdmin && (
                <Link to="/admin" className="hover:text-yellow-400 transition-colors">Admin</Link>
              )}
              <span className="bg-green-900 text-green-300 px-3 py-1 rounded-full font-medium">
                ₹{user.walletBalance}
              </span>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-green-400 transition-colors">Login</Link>
              <Link to="/register" className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded-lg transition-colors">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
