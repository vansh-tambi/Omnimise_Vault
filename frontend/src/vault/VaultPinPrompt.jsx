import { useState } from 'react';
import { useVaultKey } from '../context/VaultKeyContext';
import { deriveKey } from '../encryption/crypto';
import { KeyRound } from 'lucide-react';

export default function VaultPinPrompt({ vaultId, onKeyDerived }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { unlockVault } = useVaultKey();

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!pin) return;
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const key = await unlockVault(vaultId, pin, token);
      onKeyDerived(key);
    } catch (err) {
      console.error(err);
      alert('Failed to unlock vault');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-sm mx-auto p-8 flex flex-col items-center shadow-xl border-blue-500/20">
      <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <KeyRound className="w-8 h-8 text-blue-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Vault Locked</h3>
      <p className="text-gray-400 text-sm text-center mb-6">Enter your PIN to derive encryption keys. The server will never see this.</p>
      
      <form onSubmit={handleUnlock} className="w-full flex gap-3 flex-col">
        <input 
          type="password" 
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="input-field text-center tracking-[0.5em] font-mono text-xl" 
          placeholder="••••"
          maxLength={8}
          required
          autoFocus
        />
        <button type="submit" disabled={loading} className="btn-primary w-full shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition">
          {loading ? 'Unlocking...' : 'Unlock Vault'}
        </button>
      </form>
    </div>
  );
}
