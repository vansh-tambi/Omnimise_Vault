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
      // Generate a new random salt for this vault's PIN
      const saltRaw = crypto.getRandomValues(new Uint8Array(16));
      // Encode salt as base64 (matching Python's base64.b64decode on the backend)
      const saltB64 = btoa(String.fromCharCode(...saltRaw));
      
      // Hash the PIN locally using same algorithm as backend (PBKDF2 → base64)
      const { hashPIN } = await import('../encryption/crypto.js');
      const vault_pin_hash = await hashPIN(pin, saltRaw);

      const res = await api.post('/vault/create', { 
        name, 
        description,
        vault_pin_hash,
        vault_pin_salt: saltB64 // Send salt as base64
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
