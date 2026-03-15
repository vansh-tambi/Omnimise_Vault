import { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  deriveKey, 
  generateRSAKeyPair, 
  exportPublicKeyAsBase64, 
  exportPrivateKeyAsBase64,
  importPrivateKeyFromBase64
} from '../encryption/crypto';
import api from '../services/api';

const VaultKeyContext = createContext();

export function VaultKeyProvider({ children }) {
  const [vaultKey, setVaultKey] = useState(null);
  const [rsaPrivateKey, setRsaPrivateKey] = useState(null);
  const interactivityTimer = useRef(null);
  const navigate = useNavigate();

  const clearKey = () => {
    setVaultKey(null);
    setRsaPrivateKey(null);
    sessionStorage.removeItem('rsa_private_key');
    // Explicit memory dereference — key eligible for garbage collection
  };

  const resetInactivityTimer = () => {
    if (interactivityTimer.current) clearTimeout(interactivityTimer.current);
    if (!vaultKey) return;

    interactivityTimer.current = setTimeout(() => {
      clearKey();
      navigate('/?locked=true');
      alert("Vault locked due to inactivity.");
    }, 300000); // 5 minutes
  };

  useEffect(() => {
    if (vaultKey) {
      resetInactivityTimer();
      const events = ['mousemove', 'keydown', 'click', 'touchstart'];
      events.forEach(event => window.addEventListener(event, resetInactivityTimer));

      return () => {
        if (interactivityTimer.current) clearTimeout(interactivityTimer.current);
        events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      };
    }
  }, [vaultKey]);

  const unlockVault = async (vaultId, pin) => {
    // 1. Verify PIN with backend first
    await api.post(`vault/${vaultId}/unlock`, { pin });

    const enc = new TextEncoder();
    const salt = enc.encode(vaultId);
    
    // 2. Derive AES key from PIN
    const currentVaultKey = await deriveKey(pin, salt);
    setVaultKey({ [vaultId]: currentVaultKey });

    // 3. Manage RSA Key Pair (fire-and-forget, don't block unlock on failure)
    try {
      let privateKeyObj;
      const storedPrivKeyB64 = sessionStorage.getItem('rsa_private_key');
      
      if (!storedPrivKeyB64) {
        // Generate new pair
        const keyPair = await generateRSAKeyPair();
        const pubB64 = await exportPublicKeyAsBase64(keyPair.publicKey);
        const privB64 = await exportPrivateKeyAsBase64(keyPair.privateKey);
        
        sessionStorage.setItem('rsa_private_key', privB64);
        privateKeyObj = keyPair.privateKey;
        
        // Register public key on backend using the stored JWT token
        const token = localStorage.getItem('token');
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        await fetch(`${apiBase}/auth/register-public-key`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ public_key: pubB64 })
        });
      } else {
        // Import existing key from session
        privateKeyObj = await importPrivateKeyFromBase64(storedPrivKeyB64);
      }
      
      setRsaPrivateKey(privateKeyObj);
    } catch (rsaErr) {
      // RSA key init failure is non-fatal for the unlock; log it but don't throw
      console.warn('RSA key init warning (non-fatal):', rsaErr);
    }
    
    return currentVaultKey;
  };

  return (
    <VaultKeyContext.Provider value={{ vaultKey, rsaPrivateKey, setVaultKey, unlockVault, clearKey }}>
      {children}
    </VaultKeyContext.Provider>
  );
}

export function useVaultKey() {
  return useContext(VaultKeyContext);
}
