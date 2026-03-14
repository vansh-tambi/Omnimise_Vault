import { createContext, useState, useContext } from 'react';

const VaultKeyContext = createContext();

export function VaultKeyProvider({ children }) {
  const [vaultKey, setVaultKey] = useState(null);

  const clearKey = () => setVaultKey(null);

  return (
    <VaultKeyContext.Provider value={{ vaultKey, setVaultKey, clearKey }}>
      {children}
    </VaultKeyContext.Provider>
  );
}

export function useVaultKey() {
  return useContext(VaultKeyContext);
}
