import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVault } from '../hooks/useVault';
import VaultCard from '../components/VaultCard';
import VaultCreate from '../vault/VaultCreate';
import { LayoutDashboard, Link2, CheckCircle2, Cloud, FileText } from 'lucide-react';
import api from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { vaults, loading, fetchVaults } = useVault();
  const [sharedDocs, setSharedDocs] = useState([]);
  const [showDigiSuccess, setShowDigiSuccess] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState(null);

  useEffect(() => {
    fetchVaults();
    fetchSharedDocs();
    
    // Check for success param from DigiLocker OAuth callback
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('digilocker') === 'connected') {
      setShowDigiSuccess(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setShowDigiSuccess(false), 5000);
    }
  }, [fetchVaults]);

  const fetchSharedDocs = async () => {
    try {
      const res = await api.get('/access/received');
      setSharedDocs(res.data);
    } catch (err) {
      console.error("Failed to fetch shared docs", err);
    }
  };

  const handleDigiLockerConnect = async () => {
    setConnectLoading(true);
    try {
      const res = await api.get('/digilocker/auth');
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      console.error("Failed to initiate DigiLocker connection", err);
      alert("Failed to connect to DigiLocker");
      setConnectLoading(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupMessage(null);
    try {
      await api.post('/backup/trigger');
      setBackupMessage({ 
        type: 'success', 
        text: 'Backup successful! Files are saved in the "Omnimise Vault Backups" folder in your Google Drive root directory.' 
      });
    } catch (err) {
      console.error("Backup failed", err);
      setBackupMessage({ type: 'error', text: 'Backup failed. Please try again or check your Google Drive connection.' });
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-700 pb-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-6 h-6 text-gray-300" />
            <h1 className="text-2xl font-semibold text-white">Your Vaults</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleBackup}
              disabled={backupLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg transition border border-gray-600"
            >
              <Cloud className="w-4 h-4" />
              {backupLoading ? "Backing up..." : "Backup to Drive"}
            </button>
            <button 
              onClick={handleDigiLockerConnect}
              disabled={connectLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition border border-blue-500/30"
            >
              <Link2 className="w-4 h-4" />
              {connectLoading ? "Connecting..." : "Connect DigiLocker"}
            </button>
          </div>
        </div>

        {backupMessage && (
          <div className={`p-4 rounded-lg flex items-center gap-3 border ${backupMessage.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <CheckCircle2 className={`w-5 h-5 ${backupMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`} />
            <p>{backupMessage.text}</p>
          </div>
        )}

        {showDigiSuccess && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
            <p>DigiLocker connected successfully!</p>
          </div>
        )}
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-800 rounded-lg"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <VaultCreate onCreated={fetchVaults} />
            {vaults.map(vault => (
               <VaultCard key={vault.id} vault={vault} onDeleted={fetchVaults} />
            ))}
          </div>
        )}
      </div>

      {sharedDocs.length > 0 && (
        <div className="space-y-6 pt-6 border-t border-gray-800">
          <div className="flex items-center gap-3">
             <Link2 className="w-6 h-6 text-blue-400" />
             <h2 className="text-xl font-semibold text-white">Shared with Me</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sharedDocs.map(share => (
              <div
                key={share.access_id}
                className="card p-5 group hover:border-blue-500/50 transition cursor-pointer"
                onClick={() => navigate(`/access?docId=${share.document_id}`)}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500/20 transition">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="truncate">
                    <h4 className="text-white font-medium truncate">{share.filename}</h4>
                    <p className="text-xs text-gray-400">Owner ID: {share.owner_id.slice(-8)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                   <span>Granted: {new Date(share.granted_at).toLocaleDateString()}</span>
                   {share.expires_at && <span className="text-red-400/80">Expires: {new Date(share.expires_at).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
