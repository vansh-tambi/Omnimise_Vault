import { useState, useEffect } from 'react';
import api from '../services/api';
import { ShieldCheck } from 'lucide-react';

export default function Access() {
  const [access, setAccess] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccess = async () => {
      try {
        const res = await api.get('/access/list?vault_id=all');
        setAccess(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAccess();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
        <ShieldCheck className="w-6 h-6 text-gray-300" />
        <h1 className="text-2xl font-semibold text-white">Shared Access</h1>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading access rights...</div>
      ) : access.length === 0 ? (
        <div className="card text-center p-12 text-gray-400 border-dashed border-2">
            No active shares.
        </div>
      ) : (
        <div className="grid gap-4 max-w-2xl">
          {access.map(acc => (
            <div key={acc.id} className="card p-4">
              <p className="text-white font-medium">Vault ID: {acc.vault_id}</p>
              <p className="text-sm text-gray-400">User ID: {acc.user_id}</p>
              <p className="text-sm text-gray-400">Permission: <span className="text-blue-400 uppercase tracking-widest text-xs ml-1">{acc.permission}</span></p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
