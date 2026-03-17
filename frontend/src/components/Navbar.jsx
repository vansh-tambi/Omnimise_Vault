import { useEffect, useState } from 'react';
import { Shield, LogOut, Activity, MessageSquare, ClipboardList, Share2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const hasSession = !!localStorage.getItem('token');
  const displayName = user?.name || 'Account';
  const displayPicture = user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
  const [badges, setBadges] = useState({ access: false, requests: false, messages: false });

  useEffect(() => {
    if (!hasSession) {
      setBadges({ access: false, requests: false, messages: false });
      return;
    }

    let cancelled = false;

    const toTime = (value) => {
      const t = value ? new Date(value).getTime() : 0;
      return Number.isNaN(t) ? 0 : t;
    };

    const pollBadges = async () => {
      try {
        const [requestsRes, inboxRes, receivedRes] = await Promise.all([
          api.get('/requests'),
          api.get('/messages/inbox'),
          api.get('/access/received'),
        ]);

        if (cancelled) return;

        const requests = requestsRes.data || [];
        const inbox = inboxRes.data || [];
        const received = receivedRes.data || [];

        const hasPendingIncomingRequest = requests.some(
          (r) => r?.target_user_id === user?.id && r?.status === 'pending'
        );
        const hasUnreadMessage = inbox.some((m) => !m?.read);

        // "Shared with me" has no read flag in backend, so detect change by latest share timestamp.
        const latestShareTs = received.reduce((maxTs, share) => {
          const ts = toTime(share?.granted_at || share?.created_at);
          return ts > maxTs ? ts : maxTs;
        }, 0);

        const accessMarkerKey = 'omnimise:last_seen_access_share_ts';
        const storedMarker = Number(localStorage.getItem(accessMarkerKey) || '0');
        const onAccessPage = location.pathname.startsWith('/access');

        let hasAccessUpdate = false;
        if (onAccessPage) {
          localStorage.setItem(accessMarkerKey, String(latestShareTs));
        } else if (latestShareTs > storedMarker) {
          hasAccessUpdate = true;
        }

        setBadges({
          access: hasAccessUpdate,
          requests: hasPendingIncomingRequest,
          messages: hasUnreadMessage,
        });
      } catch (err) {
        // Keep current badge state on transient fetch failures.
        console.warn('Navbar badge polling failed', err);
      }
    };

    pollBadges();
    const interval = setInterval(pollBadges, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasSession, location.pathname, user?.id]);

  return (
    <nav className="h-16 w-full shrink-0 border-b border-gray-700 bg-dark-bg flex items-center justify-between px-6 sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
        <Shield className="w-8 h-8 text-dark-accent" />
        <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-indigo-500">
          Omnimise Vault
        </span>
      </Link>
      
      {hasSession && (
        <div className="flex items-center gap-4">
          <Link to="/access" className="p-2 hover:bg-gray-800 rounded-full transition relative" title="Shared Documents">
            <Share2 className="w-5 h-5 text-gray-300" />
            {badges.access && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-dark-bg" />
            )}
          </Link>
          <Link to="/requests" className="p-2 hover:bg-gray-800 rounded-full transition relative" title="Requests">
            <ClipboardList className="w-5 h-5 text-gray-300" />
            {badges.requests && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-dark-bg" />
            )}
          </Link>
          <Link to="/messages" className="p-2 hover:bg-gray-800 rounded-full transition relative">
             <MessageSquare className="w-5 h-5 text-gray-300" />
             {badges.messages && (
               <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-dark-bg" />
             )}
          </Link>
          <Link to="/audit" className="p-2 hover:bg-gray-800 rounded-full transition" title="Activity Log">
             <Activity className="w-5 h-5 text-gray-300" />
          </Link>
          <div className="flex items-center gap-3 border-l border-gray-700 pl-4 ml-2">
            <Link to="/profile" title="Profile">
              <img 
                src={displayPicture}
                alt={displayName}
                className="w-8 h-8 rounded-full border border-gray-600"
              />
            </Link>
            <span className="text-sm font-medium hidden md:block">{displayName}</span>
            <button onClick={logout} className="p-2 hover:bg-gray-800 text-gray-400 hover:text-white rounded-full transition" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
