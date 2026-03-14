import { useState, useEffect } from 'react';
import { useVaultKey } from '../context/VaultKeyContext';
import api from '../services/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { clearKey } = useVaultKey();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get('/auth/me');
        setUser(response.data);
      } catch (err) {
        console.error('Auth check failed', err);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (authCode) => {
    const response = await api.post('/auth/google', { code: authCode });
    localStorage.setItem('token', response.data.access_token);
    const userResponse = await api.get('/auth/me');
    setUser(userResponse.data);
  };

  const logout = () => {
    localStorage.removeItem('token');
    clearKey();
    setUser(null);
    window.location.href = '/login';
  };

  return { user, loading, login, logout, isAuthenticated: !!user };
}
