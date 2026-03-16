import { useState } from 'react';
import { useVaultKey } from '../context/VaultKeyContext';
import { deriveVaultKey, encryptFile } from '../encryption/crypto';
import { KeyRound } from 'lucide-react';
import api from '../services/api';

export default function VaultPinPrompt({ vaultId, onKeyDerived }) {
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupMode, setSetupMode] = useState(false);
  const [setupSourceKey, setSetupSourceKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const { unlockVault } = useVaultKey();

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!pin) return;
    setLoading(true);
    
    try {
      const result = await unlockVault(vaultId, pin);
      if (result.requiresPinSetup) {
        setSetupSourceKey(result.key);
        setSetupMode(true);
      } else {
        onKeyDerived(result.key);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to unlock vault');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPin = async (e) => {
    e.preventDefault();
    if (!newPin || !confirmPin) {
      return;
    }
    if (newPin !== confirmPin) {
      alert('New PIN and confirmation must match.');
      return;
    }

    setLoading(true);
    try {
      const newKey = await deriveVaultKey(newPin, vaultId);
      const verifiedBuffer = new TextEncoder().encode('verified');
      const encryptedVerifier = await encryptFile(verifiedBuffer, newKey);
      const pinVerifier = btoa(String.fromCharCode(...new Uint8Array(encryptedVerifier)));

      await api.put(`/vault/${vaultId}`, {
        pin_verifier: pinVerifier,
        requires_pin_setup: false,
        temp_pin: null,
      });

      onKeyDerived(newKey);
      alert('PIN setup complete. Vault unlocked.');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to update vault PIN.');
    } finally {
      setLoading(false);
    }
  };

  if (setupMode) {
    return (
      <div className="card max-w-sm mx-auto p-8 flex flex-col items-center shadow-xl border-amber-500/30">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-6">
          <KeyRound className="w-8 h-8 text-amber-300" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2 text-center">Set Your New Vault PIN</h3>
        <p className="text-gray-300 text-sm text-center mb-6">
          This vault was created for you. Enter your temporary PIN to unlock, then set a new permanent PIN.
        </p>

        <form onSubmit={handleSetupPin} className="w-full flex gap-3 flex-col">
          <input
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            className="input-field text-center tracking-[0.5em] font-mono text-xl"
            placeholder="New PIN"
            maxLength={8}
            required
          />
          <input
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            className="input-field text-center tracking-[0.5em] font-mono text-xl"
            placeholder="Confirm PIN"
            maxLength={8}
            required
          />
          <button type="submit" disabled={loading || !setupSourceKey} className="btn-primary w-full shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition">
            {loading ? 'Saving...' : 'Set New PIN'}
          </button>
        </form>
      </div>
    );
  }

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
