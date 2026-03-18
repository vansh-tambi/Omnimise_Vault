import { useState } from 'react';
import { useVaultKey } from '../context/VaultKeyContext';
import { deriveVaultKey, encryptFile } from '../encryption/crypto';
import { KeyRound } from 'lucide-react';
import api from '../services/api';
import { Badge, Button, Card, Input } from '../components/ui';

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
      <Card style={{ maxWidth: '420px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>Set your vault PIN</h3>
          <Badge variant="amber">pending</Badge>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
          This vault was created for you. Enter your temporary PIN to unlock, then set a new permanent PIN.
        </p>

        <form onSubmit={handleSetupPin} style={{ display: 'grid', gap: '8px' }}>
          <Input
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            style={{ textAlign: 'center', letterSpacing: '0.3em', fontFamily: 'var(--font-mono)' }}
            placeholder="New PIN"
            maxLength={8}
            required
          />
          <Input
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            style={{ textAlign: 'center', letterSpacing: '0.3em', fontFamily: 'var(--font-mono)' }}
            placeholder="Confirm PIN"
            maxLength={8}
            required
          />
          <Button type="submit" disabled={loading || !setupSourceKey} variant="primary" style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}>
            {loading ? 'Saving...' : 'Set New PIN'}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card style={{ maxWidth: '420px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound className="w-4 h-4" />
          Vault locked
        </h3>
        <Badge variant="default">locked</Badge>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>Enter your PIN to derive encryption keys. The server never receives this PIN.</p>
      
      <form onSubmit={handleUnlock} style={{ display: 'grid', gap: '8px' }}>
        <Input
          type="password" 
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ textAlign: 'center', letterSpacing: '0.3em', fontFamily: 'var(--font-mono)' }}
          placeholder="••••"
          maxLength={8}
          required
          autoFocus
        />
        <Button type="submit" disabled={loading} variant="primary" style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}>
          {loading ? 'Unlocking...' : 'Unlock Vault'}
        </Button>
      </form>
    </Card>
  );
}
