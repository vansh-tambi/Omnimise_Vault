import { useEffect, useState } from 'react';
import { Shield, LogOut, Activity, MessageSquare, ClipboardList, Share2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';

const navStyle = {
  height: '56px',
  background: 'var(--bg-base)',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  position: 'sticky',
  top: 0,
  zIndex: 100,
};

const logoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  fontWeight: '500',
  color: 'var(--text-primary)',
  letterSpacing: '0.04em',
  textDecoration: 'none',
};

const navLinkStyle = (active) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
  textDecoration: 'none',
  borderRadius: 'var(--radius-sm)',
  border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
  background: active ? 'var(--bg-elevated)' : 'transparent',
  transition: 'color 0.15s, border-color 0.15s, background 0.15s',
});

const iconButtonStyle = {
  position: 'relative',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid transparent',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const hasSession = !!localStorage.getItem('token');
  const displayName = user?.name || 'Account';
  const displayPicture = user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
  const isLoginRoute = location.pathname === '/login';
  const [badges, setBadges] = useState({ access: false, requests: false, messages: false });

  useEffect(() => {
    if (isLoginRoute || !hasSession) {
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
  }, [hasSession, isLoginRoute, location.pathname, user?.id]);

  if (isLoginRoute) {
    return null;
  }

  const isAccess = location.pathname.startsWith('/access');
  const isRequests = location.pathname.startsWith('/requests');
  const isMessages = location.pathname.startsWith('/messages');
  const isAudit = location.pathname.startsWith('/audit');

  return (
    <nav style={navStyle}>
      <Link to="/" style={logoStyle}>
        <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        Omnimise Vault
      </Link>

      {hasSession && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link to="/access" style={navLinkStyle(isAccess)} title="Shared Documents">
            <span style={iconButtonStyle}>
              <Share2 className="w-4 h-4" />
              {badges.access && (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    height: '6px',
                    width: '6px',
                    borderRadius: '999px',
                    background: 'var(--red)',
                  }}
                />
              )}
            </span>
          </Link>

          <Link to="/requests" style={navLinkStyle(isRequests)} title="Requests">
            <span style={iconButtonStyle}>
              <ClipboardList className="w-4 h-4" />
              {badges.requests && (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    height: '6px',
                    width: '6px',
                    borderRadius: '999px',
                    background: 'var(--red)',
                  }}
                />
              )}
            </span>
          </Link>

          <Link to="/messages" style={navLinkStyle(isMessages)} title="Messages">
            <span style={iconButtonStyle}>
              <MessageSquare className="w-4 h-4" />
              {badges.messages && (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    height: '6px',
                    width: '6px',
                    borderRadius: '999px',
                    background: 'var(--red)',
                  }}
                />
              )}
            </span>
          </Link>

          <Link to="/audit" style={navLinkStyle(isAudit)} title="Activity Log">
            <span style={iconButtonStyle}>
              <Activity className="w-4 h-4" />
            </span>
          </Link>

          <div style={{ width: '1px', height: '22px', background: 'var(--border-subtle)', margin: '0 6px' }} />

          <Link to="/profile" title="Profile" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <img
              src={displayPicture}
              alt={displayName}
              style={{ width: '24px', height: '24px', borderRadius: '999px', border: '1px solid var(--border-default)' }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1 }}>{displayName}</span>
          </Link>

          <button
            onClick={logout}
            title="Logout"
            style={{
              ...iconButtonStyle,
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </nav>
  );
}
