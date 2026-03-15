import { useState, useEffect } from 'react';
import api from '../services/api';
import { MessageSquare, Send, Inbox, CheckCheck } from 'lucide-react';

export default function Messages() {
  const [tab, setTab] = useState('inbox'); // 'inbox' | 'sent' | 'compose'
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Compose form
  const [recipientEmail, setRecipientEmail] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [tab]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'sent' ? '/messages/sent' : '/messages/inbox';
      if (tab === 'compose') { setLoading(false); return; }
      const res = await api.get(endpoint);
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!recipientEmail.trim() || !messageContent.trim()) {
      alert('Please enter a recipient email and a message.');
      return;
    }
    setSending(true);
    try {
      // Look up user by email first
      const userRes = await api.get(`/access/lookup_user?email=${encodeURIComponent(recipientEmail.trim())}`);
      const receiverId = userRes.data.id;
      await api.post('/messages/send', { receiver_id: receiverId, content: messageContent.trim() });
      alert('Message sent!');
      setRecipientEmail('');
      setMessageContent('');
      setTab('sent');
    } catch (err) {
      if (err.response?.status === 404) {
        alert('No user found with that email address.');
      } else {
        alert('Failed to send message: ' + (err.response?.data?.detail || err.message));
      }
    } finally {
      setSending(false);
    }
  };

  const markRead = async (msgId) => {
    try {
      await api.post(`/messages/mark_read/${msgId}`);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_read: true } : m));
    } catch (_) {}
  };

  const tabs = [
    { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-4 h-4" /> },
    { id: 'sent', label: 'Sent', icon: <CheckCheck className="w-4 h-4" /> },
    { id: 'compose', label: 'Compose', icon: <Send className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
        <MessageSquare className="w-6 h-6 text-gray-300" />
        <h1 className="text-2xl font-semibold text-white">Messages</h1>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg w-fit border border-gray-700">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setMessages([]); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Compose */}
      {tab === 'compose' && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-medium text-white">New Message</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Recipient Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              className="input-field w-full"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
            <textarea
              value={messageContent}
              onChange={e => setMessageContent(e.target.value)}
              rows={5}
              className="input-field w-full resize-none"
              placeholder="Write your message here..."
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={sending || !recipientEmail || !messageContent}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      )}

      {/* Inbox / Sent */}
      {tab !== 'compose' && (
        loading ? (
          <div className="text-gray-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="card text-center p-12 text-gray-400 border-dashed border-2 flex flex-col items-center gap-3">
            <MessageSquare className="w-12 h-12 text-gray-600" />
            {tab === 'inbox' ? 'No messages in your inbox.' : 'No sent messages yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => tab === 'inbox' && !msg.is_read && markRead(msg.id)}
                className={`card p-4 border-l-4 cursor-pointer transition hover:bg-gray-800/70 ${
                  !msg.is_read && tab === 'inbox' ? 'border-l-blue-500 bg-blue-500/5' : 'border-l-gray-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {!msg.is_read && tab === 'inbox' && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-blue-400">
                      {tab === 'inbox' ? `From: ${msg.sender_id}` : `To: ${msg.receiver_id}`}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.sent_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-200 bg-gray-900/50 p-3 rounded-md border border-gray-700 whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
