import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Clock } from 'lucide-react';
import api from '../services/api';

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data || []);
    } catch (err) {
      console.error(err);
      alert('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id) => {
    setMarkingId(id);
    try {
      await api.post(`/notifications/mark_read/${id}`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to mark as read.');
    } finally {
      setMarkingId(null);
    }
  };

  const extractTempPin = (notification) => {
    if (notification?.data?.temp_pin) {
      return notification.data.temp_pin;
    }
    const message = notification?.message || '';
    const match = message.match(/temporary vault PIN is:\s*(\d{6})/i);
    return match?.[1] || null;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
        <Bell className="w-6 h-6 text-gray-300" />
        <h1 className="text-2xl font-semibold text-white">Notifications</h1>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="card text-center p-12 text-gray-400 border-dashed border-2">
          No notifications yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const statusLabel = notification.request_status === 'approved' ? 'Fulfilled' : 'Pending';
            const tempPin = notification.type === 'vault_created' ? extractTempPin(notification) : null;

            return (
              <div key={notification.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-gray-100">{notification.message}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${
                          statusLabel === 'Fulfilled'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {statusLabel}
                      </span>
                      {notification.read && (
                        <span className="inline-flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Read
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {notification.type === 'vault_created' && tempPin && (
                  <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-amber-300">Temporary PIN</p>
                    <p className="font-mono text-2xl text-amber-100">{tempPin}</p>
                    <p className="text-sm text-amber-200">This PIN is shown only once. Save it immediately and change it after logging in.</p>
                  </div>
                )}

                {notification.type === 'document_request' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/requests?requestId=${notification.request_id || ''}`)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition"
                    >
                      View Request
                    </button>
                    <button
                      onClick={() => handleMarkRead(notification.id)}
                      disabled={notification.read || markingId === notification.id}
                      className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-200 text-sm hover:bg-gray-600 transition disabled:opacity-50"
                    >
                      {notification.read ? 'Read' : 'Mark as Read'}
                    </button>
                  </div>
                )}

                {notification.type !== 'document_request' && !notification.read && (
                  <div>
                    <button
                      onClick={() => handleMarkRead(notification.id)}
                      disabled={markingId === notification.id}
                      className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-200 text-sm hover:bg-gray-600 transition disabled:opacity-50"
                    >
                      Mark as Read
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
