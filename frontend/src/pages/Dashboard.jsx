import { useEffect, useState } from 'react';
import { useVault } from '../hooks/useVault';
import VaultCard from '../components/VaultCard';
import VaultCreate from '../vault/VaultCreate';
import { PageHeader } from '../components/ui';

export default function Dashboard() {
  const { vaults, loading, fetchVaults } = useVault();

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '8px 12px 24px' }}>
      <PageHeader
        title="Your Vaults"
        subtitle="Manage encrypted vaults"
      />
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1,2,3].map(i => <div key={i} style={{ height: '190px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <VaultCreate onCreated={fetchVaults} />
            {vaults.map(vault => (
               <VaultCard key={vault.id} vault={vault} onDeleted={fetchVaults} />
            ))}
          </div>
        )}
    </div>
  );
}
