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

  const createVault = async (name, description) => {
    setLoading(true);
    try {
      const res = await api.post('/vault/create', { name, description });
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
