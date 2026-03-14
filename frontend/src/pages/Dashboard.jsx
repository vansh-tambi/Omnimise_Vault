import { useEffect } from 'react';
import { useVault } from '../hooks/useVault';
import VaultCard from '../components/VaultCard';
import VaultCreate from '../vault/VaultCreate';
import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  const { vaults, loading, fetchVaults } = useVault();

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
        <LayoutDashboard className="w-6 h-6 text-gray-300" />
        <h1 className="text-2xl font-semibold text-white">Your Dashboard</h1>
      </div>
      
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
