import { useEffect, useState } from 'react';
import { Shield, Bell, LogOut, Settings, Activity, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let alive = true;
    const fetchUnreadCount = async () => {
      try {
        const response = await api.get('/notifications/unread_count');
        if (alive) {
          setUnreadCount(response.data.count || 0);
        }
      } catch (_) {
        if (alive) {
          setUnreadCount(0);
        }
      }
    };

    fetchUnreadCount();
    const intervalId = window.setInterval(fetchUnreadCount, 10000);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [user]);

  return (
    <nav className="h-16 w-full shrink-0 border-b border-gray-700 bg-dark-bg flex items-center justify-between px-6 sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
        <Shield className="w-8 h-8 text-dark-accent" />
        <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-indigo-500">
          Omnimise Vault
        </span>
      </Link>
      
      {user && (
        <div className="flex items-center gap-4">
          <Link to="/notifications" className="p-2 hover:bg-gray-800 rounded-full transition relative" title="Notifications">
            <Bell className="w-5 h-5 text-gray-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.1rem] px-1 h-[1.1rem] rounded-full bg-red-500 text-[10px] leading-[1.1rem] text-white text-center font-semibold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <Link to="/requests" className="p-2 hover:bg-gray-800 rounded-full transition relative" title="Requests">
            <UserRound className="w-5 h-5 text-gray-300" />
          </Link>
          <Link to="/messages" className="p-2 hover:bg-gray-800 rounded-full transition">
             <Settings className="w-5 h-5 text-gray-300" />
          </Link>
          <Link to="/audit" className="p-2 hover:bg-gray-800 rounded-full transition" title="Activity Log">
             <Activity className="w-5 h-5 text-gray-300" />
          </Link>
          <Link to="/profile" className="p-2 hover:bg-gray-800 rounded-full transition" title="Profile">
             <UserRound className="w-5 h-5 text-gray-300" />
          </Link>
          <div className="flex items-center gap-3 border-l border-gray-700 pl-4 ml-2">
            <img 
              src={user.picture || `https://ui-avatars.com/api/?name=${user.name}&background=random`} 
              alt={user.name} 
              className="w-8 h-8 rounded-full border border-gray-600"
            />
            <span className="text-sm font-medium hidden md:block">{user.name}</span>
            <button onClick={logout} className="p-2 hover:bg-gray-800 text-gray-400 hover:text-white rounded-full transition" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
