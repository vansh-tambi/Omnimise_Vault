import { createContext, useState, useContext } from 'react';
import { 
  deriveKey, 
  generateRSAKeyPair, 
  exportPublicKeyAsBase64, 
  exportPrivateKeyAsBase64,
  importPrivateKeyFromBase64
} from '../encryption/crypto';

const VaultKeyContext = createContext();

export function VaultKeyProvider({ children }) {
  const [vaultKey, setVaultKey] = useState(null);
  const [rsaPrivateKey, setRsaPrivateKey] = useState(null);

  const clearKey = () => {
    setVaultKey(null);
    setRsaPrivateKey(null);
  };

  const unlockVault = async (vaultId, pin, authToken) => {
    const enc = new TextEncoder();
    const salt = enc.encode(vaultId);
    
    // 1. Derive AES key
    const currentVaultKey = await deriveKey(pin, salt);
    setVaultKey({ [vaultId]: currentVaultKey });

    // 2. Manage RSA Key Pair
    let privateKeyObj;
    const storedPrivKeyB64 = sessionStorage.getItem('rsa_private_key');
    
    if (!storedPrivKeyB64) {
      // Generate new pair
      const keyPair = await generateRSAKeyPair();
      const pubB64 = await exportPublicKeyAsBase64(keyPair.publicKey);
      const privB64 = await exportPrivateKeyAsBase64(keyPair.privateKey);
      
      sessionStorage.setItem('rsa_private_key', privB64);
      privateKeyObj = keyPair.privateKey;
      
      // Register public key on backend
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      await fetch(`${apiBase}/auth/register-public-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ public_key: pubB64 })
      });
    } else {
      // Import existing key from session
      privateKeyObj = await importPrivateKeyFromBase64(storedPrivKeyB64);
    }
    
    setRsaPrivateKey(privateKeyObj);
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
