import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [contests, setContests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [tab, setTab] = useState('contests');

  // Deposit state
  const [depositAmount, setDepositAmount] = useState('');
  const [depositStep, setDepositStep] = useState('input');
  const [upiData, setUpiData] = useState(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [depositMsg, setDepositMsg] = useState('');
  const [depositError, setDepositError] = useState('');

  // Withdraw state
  const [withdrawStep, setWithdrawStep] = useState('form'); // form | done
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', method: 'upi', upiId: '', accountName: '', accountNumber: '', ifsc: '' });
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const fetchData = () => {
    api.get('/contests/my').then(({ data }) => setContests(data));
    api.get('/wallet/transactions').then(({ data }) => setTransactions(data));
    api.get('/wallet/withdrawals').then(({ data }) => setWithdrawals(data));
  };

  useEffect(() => { fetchData(); }, []);

  // ── Deposit handlers ──
  const handleCreateOrder = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount < 10) return setDepositError('Minimum ₹10');
    setDepositError('');
    try {
      const { data } = await api.post('/wallet/create-order', { amount });
      setUpiData(data);
      setDepositStep('upi');
    } catch (err) {
      setDepositError(err.response?.data?.message || 'Failed');
    }
  };


  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');

  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setDepositError('Screenshot must be under 2MB');
    const reader = new FileReader();
    reader.onload = (ev) => {
      setScreenshot(ev.target.result); // base64
      setScreenshotPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPayment = async () => {
    if (!utrNumber.trim()) return setDepositError('Enter UTR/Transaction ID');
    if (!screenshot) return setDepositError('Screenshot of payment is required');
    setDepositError('');
    try {
      await api.post('/wallet/confirm-payment', { txnRef: upiData.txnRef, utrNumber, screenshot });
      setDepositStep('done');
      setDepositMsg('Payment submitted! Admin will verify and credit your wallet shortly.');
      setDepositAmount('');
      setUtrNumber('');
      setScreenshot(null);
      setScreenshotPreview('');
    } catch (err) {
      setDepositError(err.response?.data?.message || 'Failed');
    }
  };

  // ── Withdraw handler ──
  const handleWithdraw = async (e) => {
    e.preventDefault();
    setWithdrawError('');
    const amt = Number(withdrawForm.amount);
    if (!amt || amt < 100) return setWithdrawError('Minimum withdrawal is ₹100');
    if (amt > (user?.walletBalance || 0)) return setWithdrawError('Insufficient balance');
    if (withdrawForm.method === 'upi' && !withdrawForm.upiId.trim()) return setWithdrawError('Enter UPI ID');
    if (withdrawForm.method === 'bank' && (!withdrawForm.accountName || !withdrawForm.accountNumber || !withdrawForm.ifsc))
      return setWithdrawError('Fill all bank details');

    setWithdrawLoading(true);
    try {
      await api.post('/wallet/withdraw', withdrawForm);
      await refreshUser();
      fetchData();
      setWithdrawStep('done');
      setWithdrawMsg(`₹${amt} withdrawal request submitted. Will be processed within 24 hours.`);
      setWithdrawForm({ amount: '', method: 'upi', upiId: '', accountName: '', accountNumber: '', ifsc: '' });
    } catch (err) {
      setWithdrawError(err.response?.data?.message || 'Failed');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const statusColor = { WON: 'text-green-400', LOST: 'text-red-400', PENDING: 'text-yellow-400', REFUNDED: 'text-blue-400' };
  const wStatusColor = { PENDING: 'text-yellow-400', APPROVED: 'text-green-400', REJECTED: 'text-red-400' };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Wallet Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <p className="text-gray-400 text-sm mb-1">Wallet Balance</p>
        <p className="text-4xl font-bold text-green-400">₹{user?.walletBalance ?? 0}</p>

        {depositStep === 'input' && (
          <div className="mt-4">
            <div className="flex gap-3">
              <input type="number" placeholder="Amount (₹)" value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:border-green-500" />
              <button onClick={handleCreateOrder}
                className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Add Money
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Max ₹1,000 per day per user</p>
            {depositError && <p className="text-red-400 text-xs mt-2">{depositError}</p>}
          </div>
        )}

        {depositStep === 'upi' && upiData && (
          <div className="mt-4 space-y-3">
            <div className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Pay to</p>
                <p className="font-mono font-bold text-white">{upiData.upiId}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Amount</p>
                <p className="text-green-400 font-bold text-lg">₹{upiData.amount}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">Choose your UPI app to pay</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'phonepe', label: '📱 PhonePe', color: 'bg-purple-700 hover:bg-purple-600', url: `phonepe://pay?pa=${upiData.upiId}&pn=CricketWin&am=${upiData.amount}&cu=INR&tn=CricketWinDeposit` },
                { key: 'gpay',    label: '🔵 Google Pay', color: 'bg-blue-700 hover:bg-blue-600',  url: `tez://upi/pay?pa=${upiData.upiId}&pn=CricketWin&am=${upiData.amount}&cu=INR&tn=CricketWinDeposit` },
                { key: 'paytm',   label: '🔷 Paytm',     color: 'bg-sky-700 hover:bg-sky-600',    url: `paytmmp://pay?pa=${upiData.upiId}&pn=CricketWin&am=${upiData.amount}&cu=INR&tn=CricketWinDeposit` },
                { key: 'bhim',    label: '🇮🇳 BHIM',      color: 'bg-orange-700 hover:bg-orange-600', url: `upi://pay?pa=${upiData.upiId}&pn=CricketWin&am=${upiData.amount}&cu=INR&tn=CricketWinDeposit` },
              ].map(({ key, label, color, url }) => (
                <button key={key}
                  onClick={() => { window.location.href = url; setTimeout(() => setDepositStep('utr'), 2500); }}
                  className={`${color} py-3 rounded-xl text-sm font-semibold transition-colors`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setDepositStep('utr')}
              className="w-full text-xs text-gray-400 hover:text-white underline text-center">
              Already paid? Enter UTR →
            </button>
            <button onClick={() => setDepositStep('input')}
              className="w-full text-xs text-gray-600 hover:text-white text-center">Cancel</button>
          </div>
        )}

        {depositStep === 'utr' && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-300">Enter the 12-digit UTR from your UPI app payment receipt</p>
            <input type="text" placeholder="e.g. 425123456789 (12 digits)" value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
              maxLength={12}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 font-mono tracking-widest" />
            <p className="text-xs text-gray-500">Find UTR in: PhonePe → History → Transaction Details → UTR No.</p>

            {/* Screenshot upload */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Payment Screenshot <span className="text-red-400">*</span></label>
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-green-500 transition-colors bg-gray-800">
                {screenshotPreview ? (
                  <img src={screenshotPreview} alt="screenshot" className="h-full w-full object-contain rounded-xl p-1" />
                ) : (
                  <div className="text-center">
                    <p className="text-2xl">📷</p>
                    <p className="text-xs text-gray-400 mt-1">Tap to upload screenshot</p>
                    <p className="text-xs text-gray-600">Max 2MB</p>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotChange} />
              </label>
            </div>

            {depositError && <p className="text-red-400 text-xs">{depositError}</p>}
            <div className="flex gap-2">
              <button onClick={handleConfirmPayment}
                className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Submit</button>
              <button onClick={() => setDepositStep('upi')}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition-colors">Back</button>
            </div>
          </div>
        )}

        {depositStep === 'done' && (
          <div className="mt-4 bg-green-900/30 border border-green-700 rounded-lg p-3">
            <p className="text-green-400 text-sm">{depositMsg}</p>
            <button onClick={() => { setDepositStep('input'); setDepositMsg(''); }}
              className="text-xs text-gray-400 hover:text-white mt-2 underline">Add more money</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['contests', 'withdraw', 'transactions'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Contests */}
      {tab === 'contests' && (
        <div className="space-y-3">
          {contests.length === 0 ? (
            <p className="text-gray-500">No contests joined yet.</p>
          ) : contests.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.matchId?.teamA} vs {c.matchId?.teamB}</p>
                <p className="text-sm text-gray-400">Picked: <span className="text-white">{c.selectedTeam}</span></p>
                <p className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${statusColor[c.status]}`}>{c.status}</p>
                {c.status === 'WON' && <p className="text-green-400 text-sm">+₹{c.winnings}</p>}
                <p className="text-gray-500 text-xs">-₹{c.amount}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Withdraw */}
      {tab === 'withdraw' && (
        <div className="space-y-4">
          {withdrawStep === 'form' && (
            <form onSubmit={handleWithdraw} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md space-y-4">
              <h3 className="font-semibold text-lg">Withdraw Money</h3>
              <p className="text-xs text-gray-500">Available: <span className="text-green-400 font-bold">₹{user?.walletBalance ?? 0}</span> — Min ₹100</p>

              <input type="number" placeholder="Amount (₹)" min="100" value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
                required />

              {/* Method toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-700">
                {['upi', 'bank'].map((m) => (
                  <button key={m} type="button"
                    onClick={() => setWithdrawForm({ ...withdrawForm, method: m })}
                    className={`flex-1 py-2 text-sm font-medium transition-colors uppercase ${
                      withdrawForm.method === m ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>
                    {m === 'upi' ? '📲 UPI' : '🏦 Bank Transfer'}
                  </button>
                ))}
              </div>

              {withdrawForm.method === 'upi' && (
                <input type="text" placeholder="Your UPI ID (e.g. name@upi)" value={withdrawForm.upiId}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, upiId: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
                  required />
              )}

              {withdrawForm.method === 'bank' && (
                <div className="space-y-3">
                  <input type="text" placeholder="Account Holder Name" value={withdrawForm.accountName}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, accountName: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
                    required />
                  <input type="text" placeholder="Account Number" value={withdrawForm.accountNumber}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, accountNumber: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
                    required />
                  <input type="text" placeholder="IFSC Code" value={withdrawForm.ifsc}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, ifsc: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
                    required />
                </div>
              )}

              {withdrawError && <p className="text-red-400 text-sm">{withdrawError}</p>}
              <button type="submit" disabled={withdrawLoading}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-colors">
                {withdrawLoading ? 'Submitting...' : 'Request Withdrawal'}
              </button>
              <p className="text-xs text-gray-500 text-center">Amount will be deducted immediately and refunded if rejected.</p>
            </form>
          )}

          {withdrawStep === 'done' && (
            <div className="bg-green-900/30 border border-green-700 rounded-xl p-5 text-center space-y-3">
              <p className="text-2xl">✅</p>
              <p className="text-green-400 font-semibold">{withdrawMsg}</p>
              <button onClick={() => { setWithdrawStep('form'); setWithdrawMsg(''); }}
                className="text-sm text-gray-400 hover:text-white underline">Make another request</button>
            </div>
          )}

          {/* Past withdrawals */}
          {withdrawals.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-sm text-gray-400 font-medium">Past Requests</p>
              {withdrawals.map((w) => (
                <div key={w.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{w.method?.toUpperCase()} — {w.upiId || w.accountNumber}</p>
                    <p className="text-xs text-gray-500">{new Date(w.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-400">-₹{w.amount}</p>
                    <p className={`text-xs font-medium ${wStatusColor[w.status]}`}>{w.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transactions */}
      {tab === 'transactions' && (
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <p className="text-gray-500">No transactions yet.</p>
          ) : transactions.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold capitalize">{t.type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-500">{t.description}</p>
                <p className="text-xs text-gray-600">{new Date(t.createdAt).toLocaleString()}</p>
              </div>
              <p className={`font-bold ${['ENTRY_FEE', 'WITHDRAWAL_REQUEST'].includes(t.type) ? 'text-red-400' : 'text-green-400'}`}>
                {['ENTRY_FEE', 'WITHDRAWAL_REQUEST'].includes(t.type) ? '-' : '+'}₹{t.amount}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
