import { useState, useEffect } from 'react';
import api from '../services/api';
import { UserCheck, Check, X } from 'lucide-react';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/requests');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (id, status) => {
    try {
      await api.post('/requests/respond', { request_id: id, status });
      fetchRequests();
    } catch (err) {
      alert("Failed to respond");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
        <UserCheck className="w-6 h-6 text-gray-300" />
        <h1 className="text-2xl font-semibold text-white">Access Requests</h1>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="card text-center p-12 text-gray-400 border-dashed border-2">
            No pending access requests.
        </div>
      ) : (
        <div className="grid gap-4 max-w-2xl">
          {requests.map(req => (
            <div key={req.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Vault ID: {req.vault_id}</p>
                <p className="text-sm text-gray-400">Status: <span className={`capitalize ${req.status === 'pending' ? 'text-yellow-500' : req.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>{req.status}</span></p>
              </div>
              
              {req.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <button onClick={() => handleResponse(req.id, 'approved')} className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-md transition">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleResponse(req.id, 'rejected')} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
