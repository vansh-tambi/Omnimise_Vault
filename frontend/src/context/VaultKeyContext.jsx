import { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  deriveVaultKey, 
  generateRSAKeyPair, 
  exportPublicKeyAsBase64, 
  exportPrivateKeyAsBase64,
  importPrivateKeyFromBase64,
  decryptFile
} from '../encryption/crypto';
import api from '../services/api';

const VaultKeyContext = createContext();

export function VaultKeyProvider({ children }) {
  const [vaultKey, setVaultKey] = useState(null);
  const [rsaPrivateKey, setRsaPrivateKey] = useState(null);
  const interactivityTimer = useRef(null);
  const navigate = useNavigate();

  // One-time migration: clear any RSA key stored with the old broken export format
  // so it gets regenerated cleanly on next vault unlock
  useEffect(() => {
    const KEY_VERSION = 'v3'; // bump this to force re-generation
    const storedVersion = localStorage.getItem('rsa_key_version');
    if (storedVersion !== KEY_VERSION) {
      // Keep the RSA keypair in sync; partial deletion causes unwrap failures later.
      localStorage.removeItem('rsa_public_key');
      localStorage.removeItem('rsa_private_key');
      localStorage.setItem('rsa_key_version', KEY_VERSION);
    }
  }, []);

  const clearKey = () => {
    setVaultKey(null);
    // Don't remove RSA private key, otherwise all shares break after 5 mins inactivity!
    setRsaPrivateKey(null);
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
    // 1. Derive AES key directly from PIN and vaultId
    const currentVaultKey = await deriveVaultKey(pin, vaultId);

    const vaultResp = await api.get(`/vault/${vaultId}`);
    const vaultData = vaultResp.data;

    if (vaultData?.requires_pin_setup) {
      await api.post(`/vault/${vaultId}/unlock`, { pin });
      return {
        key: currentVaultKey,
        requiresPinSetup: true,
        vault: vaultData,
      };
    }

    // 2. Zero-Knowledge validation: Attempt to decrypt pin_verifier using the derived key
    try {
      if (vaultData && vaultData.pin_verifier) {
        const binaryString = atob(vaultData.pin_verifier);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const decrypted = await decryptFile(bytes.buffer, currentVaultKey);
        const text = new TextDecoder().decode(decrypted);
        if (text !== "verified") throw new Error("Invalid PIN");
      }
    } catch (err) {
      throw new Error("Invalid Vault PIN");
    }

    // 3. Only tell backend to log it *after* we verified it ourselves
    try {
      await api.post(`vault/${vaultId}/unlock`, { pin });
    } catch (err) {
      // ignore
    }

    setVaultKey(prev => ({ ...prev, [vaultId]: currentVaultKey }));

    // 3. Manage RSA Key Pair (fire-and-forget, don't block unlock on failure)
    try {
      let privateKeyObj;
      const storedPrivKeyB64 = localStorage.getItem('rsa_private_key');
      
      if (!storedPrivKeyB64) {
        // Generate new pair
        const keyPair = await generateRSAKeyPair();
        const pubB64 = await exportPublicKeyAsBase64(keyPair.publicKey);
        const privB64 = await exportPrivateKeyAsBase64(keyPair.privateKey);
        
        localStorage.setItem('rsa_public_key', pubB64);
        localStorage.setItem('rsa_private_key', privB64);
        privateKeyObj = keyPair.privateKey;
        
        // Register public key using the shared API client (env baseURL + auth interceptor)
        await api.post('/auth/register-public-key', { public_key: pubB64 });
      } else {
        // Import existing key from session
        privateKeyObj = await importPrivateKeyFromBase64(storedPrivKeyB64);
      }
      
      setRsaPrivateKey(privateKeyObj);
    } catch (rsaErr) {
      // RSA key init failure is non-fatal for the unlock; log it but don't throw
      console.warn('RSA key init warning (non-fatal):', rsaErr);
    }
    
    return {
      key: currentVaultKey,
      requiresPinSetup: false,
      vault: vaultData,
    };
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
