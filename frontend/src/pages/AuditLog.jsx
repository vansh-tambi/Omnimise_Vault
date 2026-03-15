import { useState, useEffect } from 'react';
import api from '../services/api';
import { Activity, Clock, ShieldAlert } from 'lucide-react';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/audit/logs');
        setLogs(res.data);
      } catch (err) {
        console.error("Failed to fetch audit logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const formatAction = (action) => {
    return action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
        <Activity className="w-6 h-6 text-gray-300" />
        <h1 className="text-2xl font-semibold text-white">Activity Log</h1>
      </div>

      <div className="flex gap-3 mb-4 bg-gray-800/50 p-4 font-mono text-sm border border-gray-700 rounded-lg">
        <ShieldAlert className="w-5 h-5 text-gray-400 shrink-0" />
        <p className="text-gray-400">
          This log tracks cryptographic boundary events, including authentication unlocks and document decryption triggers. 
          Limited to the last 50 events.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Timestamp</th>
                <th className="px-6 py-4 font-medium">Action</th>
                <th className="px-6 py-4 font-medium">Document ID</th>
                <th className="px-6 py-4 font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">Loading audit trail...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No activity recorded yet in this account.</td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/50 transition duration-150">
                    <td className="px-6 py-4 flex items-center gap-2 whitespace-nowrap">
                      <Clock className="w-4 h-4 text-blue-400/70" />
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-white font-medium">
                      {formatAction(log.action)}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {log.document_id || "N/A"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-green-400/80">
                      {log.ip_address}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
