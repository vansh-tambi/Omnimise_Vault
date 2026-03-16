import { useState } from 'react';
import api from '../services/api';
import { 
  importPublicKeyFromBase64, 
  wrapVaultKey 
} from '../encryption/crypto';

export default function ShareDocument({ document, currentKey, onClose, onSuccess, prefillEmail = '' }) {
  const [recipientQuery, setRecipientQuery] = useState(prefillEmail);
  const [recipientMatch, setRecipientMatch] = useState(null);
  const [loading, setLoading] = useState(false);

  const resetLookup = () => {
    setRecipientMatch(null);
  };

  const lookupRecipient = async () => {
    const trimmedQuery = recipientQuery.trim();
    if (!trimmedQuery || !document || !currentKey) {
      alert("Cannot share: Missing recipient email or Account ID, or the vault is locked.");
      return;
    }

    setLoading(true);
    try {
      const userRes = await api.get(`/access/lookup_user?query=${encodeURIComponent(trimmedQuery)}`);
      setRecipientMatch(userRes.data);
    } catch(err) {
      console.error('[ShareDocument] Error:', err);
      if (err.response?.status === 404) {
         alert(err.response?.data?.detail || 'No user found with that email or ID.');
      } else {
         alert('Failed to look up recipient: ' + (err.response?.data?.detail || err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const executeShare = async () => {
    if (!recipientMatch || !document || !currentKey) {
      alert('Look up a recipient and confirm before sharing.');
      return;
    }

    setLoading(true);
    try {
      const { user_id: recipientId, rsa_public_key } = recipientMatch;
      console.log('[ShareDocument] raw rsa_public_key (first 80 chars):', rsa_public_key?.slice(0, 80));
      const recipientPublicKey = await importPublicKeyFromBase64(rsa_public_key);
      const wrappedKey = await wrapVaultKey(currentKey, recipientPublicKey);

      const payload = {
         document_id: document.id,
         shared_with: recipientId,
         encrypted_key_for_recipient: wrappedKey,
         permission: 'read'
      };

      await api.post('/access/share', payload);
      alert('Document shared securely!');
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      console.error('[ShareDocument] Error:', err);
      alert('Failed to share document: ' + (err.response?.data?.detail || err.message || 'Unknown error'));
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
            <label className="block text-sm font-medium text-gray-300 mb-1">Recipient email or Account ID</label>
            <input 
              type="text"
              value={recipientQuery}
              onChange={(e) => {
                setRecipientQuery(e.target.value);
                if (recipientMatch) {
                  resetLookup();
                }
              }}
              className="input-field w-full" 
              placeholder="e.g. colleague@company.com or 67f1..."
            />
          </div>
          {recipientMatch && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <p className="font-medium">You are about to share with: {recipientMatch.email}. Confirm?</p>
            </div>
          )}
          <div className="text-xs text-blue-400/80 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
            The vault key will be algorithmically wrapped using the recipient's RSA public key. The server cannot derive the AES key.
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button disabled={loading} onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition">Cancel</button>
          {recipientMatch ? (
            <>
              <button disabled={loading} onClick={resetLookup} className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition">Cancel</button>
              <button disabled={loading} onClick={executeShare} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20">
                {loading ? 'Sharing...' : 'Confirm'}
              </button>
            </>
          ) : (
            <button disabled={loading || !recipientQuery.trim()} onClick={lookupRecipient} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20">
              {loading ? 'Looking up...' : 'Continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
