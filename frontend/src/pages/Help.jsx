import { useState, useEffect } from 'react';
import api from '../api/axios';

const SUBJECTS = [
  'Deposit not credited',
  'Withdrawal not received',
  'Wrong result / payout issue',
  'Account issue',
  'Other',
];

export default function Help() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState([]);

  const fetchTickets = async () => {
    try {
      const { data } = await api.get('/support/my-tickets');
      setTickets(data);
    } catch {}
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject) return setError('Please select a subject');
    if (!message.trim()) return setError('Please describe your issue');
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/support/ticket', { subject, message });
      setMsg(data.message);
      setSubject('');
      setMessage('');
      fetchTickets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = { OPEN: 'text-yellow-400', RESOLVED: 'text-green-400', CLOSED: 'text-gray-400' };
  const statusBg = { OPEN: 'bg-yellow-900/30 border-yellow-700', RESOLVED: 'bg-green-900/30 border-green-700', CLOSED: 'bg-gray-800 border-gray-700' };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Help & Support</h1>

      {/* Submit ticket */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Submit an Issue</h2>
        <p className="text-xs text-gray-400">Describe your problem and admin will resolve it shortly.</p>

        {msg && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-green-400 text-sm">{msg}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <select value={subject} onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-500">
            <option value="">Select subject...</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <textarea value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue in detail (e.g. UTR number, match name, amount...)"
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-500 resize-none" />

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition-colors">
            {loading ? 'Submitting...' : 'Submit Issue'}
          </button>
        </form>
      </div>

      {/* Previous tickets */}
      {tickets.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-300">Your Previous Tickets</h2>
          {tickets.map((t) => (
            <div key={t.id} className={`border rounded-xl p-4 space-y-2 ${statusBg[t.status]}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{t.subject}</p>
                <span className={`text-xs font-bold ${statusColor[t.status]}`}>{t.status}</span>
              </div>
              <p className="text-xs text-gray-400">{t.message}</p>
              {t.adminReply && (
                <div className="bg-gray-800 rounded-lg p-3 mt-2">
                  <p className="text-xs text-yellow-400 font-semibold mb-1">Admin Reply:</p>
                  <p className="text-xs text-gray-200">{t.adminReply}</p>
                </div>
              )}
              <p className="text-xs text-gray-600">{new Date(t.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
