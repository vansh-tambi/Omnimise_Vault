import { useState, useEffect } from 'react';
import api from '../services/api';
import { MessageSquare, Send } from 'lucide-react';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await api.get('/messages/inbox');
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
        <MessageSquare className="w-6 h-6 text-gray-300" />
        <h1 className="text-2xl font-semibold text-white">Secure Inbox</h1>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading secure messages...</div>
      ) : messages.length === 0 ? (
        <div className="card text-center p-12 text-gray-400 border-dashed border-2 flex flex-col items-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mb-4" />
            No new messages.
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`card p-4 border-l-4 ${!msg.is_read ? 'border-l-blue-500' : 'border-l-gray-600'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium text-blue-400">From: {msg.sender_id}</span>
                <span className="text-xs text-gray-500">{new Date(msg.sent_at).toLocaleString()}</span>
              </div>
              <p className="text-gray-200 bg-gray-900/50 p-3 rounded-md border border-gray-700">{msg.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
