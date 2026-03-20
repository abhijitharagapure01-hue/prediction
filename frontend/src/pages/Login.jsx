import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendOtp, verifyOtp } from '../api/firebaseAuth';

export default function Login() {
  const { login, phoneLogin } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('phone'); // 'phone' | 'email'
  const [step, setStep] = useState('input'); // 'input' | 'otp'

  // Phone fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionInfo, setSessionInfo] = useState('');

  // Email fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    const formatted = phone.startsWith('+') ? phone : `+91${phone}`;
    if (formatted.length < 12) return setError('Enter valid 10-digit mobile number');
    setLoading(true);
    try {
      // reCAPTCHA token — for testing use 'test' if test phone numbers are configured in Firebase
      const info = await sendOtp(formatted, 'test');
      setSessionInfo(info);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const idToken = await verifyOtp(sessionInfo, otp);
      await phoneLogin(idToken, null);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-2 text-center">Login</h2>

        {/* Mode toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-700 mb-6">
          {['phone', 'email'].map((m) => (
            <button key={m} onClick={() => { setMode(m); setStep('input'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
                mode === m ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {m === 'phone' ? '📱 Mobile OTP' : '✉️ Email'}
            </button>
          ))}
        </div>

        {mode === 'phone' && step === 'input' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="flex">
              <span className="bg-gray-700 border border-gray-600 border-r-0 rounded-l-lg px-3 flex items-center text-gray-400 text-sm">+91</span>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-r-lg px-4 py-3 focus:outline-none focus:border-green-500"
                required
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-colors">
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {mode === 'phone' && step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-gray-400 text-sm text-center">OTP sent to +91{phone}</p>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-center text-xl tracking-widest focus:outline-none focus:border-green-500"
              maxLength={6}
              required
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading || otp.length < 6}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-colors">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={() => { setStep('input'); setOtp(''); setError(''); }}
              className="w-full text-gray-500 text-sm hover:text-white">
              ← Change number
            </button>
          </form>
        )}

        {mode === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
              required />
            <input type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
              required />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-colors">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}

        <p className="text-center text-gray-500 text-sm mt-4">
          No account? <Link to="/register" className="text-green-400 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
