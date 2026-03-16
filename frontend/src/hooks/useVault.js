import { useState, useCallback } from 'react';
import api from '../services/api';

export function useVault() {
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchVaults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/vault');
      setVaults(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createVault = async (name, description, pin) => {
    setLoading(true);
    try {
      const { deriveVaultKey, encryptFile } = await import('../encryption/crypto.js');
      const vaultId = crypto.randomUUID();
      const vaultKey = await deriveVaultKey(pin, vaultId);

      // Encrypt the "verified" string to act as our zero-knowledge PIN checker
      const encoder = new TextEncoder();
      const verifiedBuffer = encoder.encode("verified");
      const encryptedBuffer = await encryptFile(verifiedBuffer, vaultKey);
      
      const pin_verifier = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));

      const res = await api.post('/vault/create', { 
        id: vaultId,
        name, 
        description,
        pin_verifier
      });
      
      setVaults(prev => [...prev, res.data]);
      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { vaults, loading, error, fetchVaults, createVault };
}
