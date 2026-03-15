import { useState } from 'react';
import api from '../services/api';
import { 
  importPublicKeyFromBase64, 
  wrapVaultKey 
} from '../encryption/crypto';

export default function ShareDocument({ document, currentKey, onClose, onSuccess, prefillEmail = '' }) {
  const [recipientEmail, setRecipientEmail] = useState(prefillEmail);
  const [maxViews, setMaxViews] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);

  const executeShare = async () => {
    if (!recipientEmail || !document || !currentKey) {
      alert("Cannot share: Missing recipient email or Vault is locked.");
      return;
    }
    setLoading(true);
    try {
      // Lookup the user by email to get their ID and RSA Public Key
      const userRes = await api.get(`/access/lookup_user?email=${encodeURIComponent(recipientEmail)}`);
      const { id: recipientId, rsa_public_key } = userRes.data;

      if (!rsa_public_key) {
        alert("This user has not initialized their RSA keys. They need to log in and unlock a vault first.");
        setLoading(false);
        return;
      }

      console.log('[ShareDocument] raw rsa_public_key (first 80 chars):', rsa_public_key?.slice(0, 80));
      const recipientPublicKey = await importPublicKeyFromBase64(rsa_public_key);
      const wrappedKey = await wrapVaultKey(currentKey, recipientPublicKey);
      
      const payload = {
         document_id: document.id,
         shared_with: recipientId,
         encrypted_key_for_recipient: wrappedKey,
         permission: "read"
      };
      
      if (maxViews) payload.max_views = parseInt(maxViews, 10);
      if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();

      await api.post('/access/share', payload);
      alert('Document shared securely!');
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch(err) {
      console.error('[ShareDocument] Error:', err);
      if (err.response?.status === 404) {
         alert("User with that email not found.");
      } else {
         alert('Failed to share document: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md bg-gray-900 border-blue-500/30 p-6 rounded-lg shadow-xl">
        <h3 className="text-xl font-bold text-white mb-2">Securely Share Document</h3>
        <p className="text-sm text-gray-400 mb-6 truncate">Sharing: {document.filename}</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Recipient Email</label>
            <input 
              type="email" 
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="input-field w-full" 
              placeholder="e.g. colleague@company.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Maximum views allowed</label>
              <input 
                type="number" 
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                className="input-field w-full" 
                placeholder="Optional"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Access expires at</label>
              <input 
                type="datetime-local" 
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="input-field w-full" 
              />
            </div>
          </div>
          <div className="text-xs text-blue-400/80 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
            The vault key will be algorithmically wrapped using the recipient's RSA public key. The server cannot derive the AES key.
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button disabled={loading} onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition">Cancel</button>
          <button disabled={loading || !recipientEmail} onClick={executeShare} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20">
            {loading ? 'Sharing...' : 'Share Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
