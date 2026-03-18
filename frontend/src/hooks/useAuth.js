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
        // Only hard-logout when token is actually invalid/expired.
        // For transient API/network errors, keep the current session state.
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (oauthPayload, publicKey) => {
    const response = await api.post('/auth/google', { ...oauthPayload, public_key: publicKey });
    localStorage.setItem('token', response.data.access_token);
    const userResponse = await api.get('/auth/me');
    setUser(userResponse.data);
    // useAuth is currently hook-local state, so force app-wide re-init after login.
    window.location.href = '/';
  };

  const logout = () => {
    localStorage.removeItem('token');
    clearKey();
    setUser(null);
    window.location.href = '/login';
  };

  return { user, loading, login, logout, isAuthenticated: !!user };
}
