import { useEffect, useState } from 'react';
import { useVault } from '../hooks/useVault';
import VaultCard from '../components/VaultCard';
import VaultCreate from '../vault/VaultCreate';
import { LayoutDashboard, Link2, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function Dashboard() {
  const { vaults, loading, fetchVaults } = useVault();
  const [showDigiSuccess, setShowDigiSuccess] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  useEffect(() => {
    fetchVaults();
    
    // Check for success param from DigiLocker OAuth callback
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('digilocker') === 'connected') {
      setShowDigiSuccess(true);
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setShowDigiSuccess(false), 5000);
    }
  }, [fetchVaults]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-700 pb-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-gray-300" />
          <h1 className="text-2xl font-semibold text-white">Your Dashboard</h1>
        </div>
        <button 
          onClick={handleDigiLockerConnect}
          disabled={connectLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition border border-blue-500/30"
        >
          <Link2 className="w-4 h-4" />
          {connectLoading ? "Connecting..." : "Connect DigiLocker"}
        </button>
      </div>

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
             <VaultCard key={vault.id} vault={vault} />
          ))}
        </div>
      )}
    </div>
  );
}
