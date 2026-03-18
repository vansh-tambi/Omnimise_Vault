import { useState } from 'react';
import api from '../services/api';
import { 
  importPublicKeyFromBase64, 
  wrapVaultKey 
} from '../encryption/crypto';
import { Badge, Button, Input, Label } from '../components/ui';

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
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>Secure document sharing</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sharing: {document.filename}</p>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <Label>Recipient email or account ID</Label>
            <Input
              type="text"
              value={recipientQuery}
              onChange={(e) => {
                setRecipientQuery(e.target.value);
                if (recipientMatch) {
                  resetLookup();
                }
              }}
              placeholder="e.g. colleague@company.com or 67f1..."
            />
          </div>
          {recipientMatch && (
            <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid rgba(68,255,136,0.2)', background: 'var(--green-dim)', padding: '10px' }}>
              <p style={{ fontSize: '12px', color: 'var(--green)' }}>You are about to share with: {recipientMatch.email}. Confirm?</p>
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
            The vault key will be algorithmically wrapped using the recipient's RSA public key. The server cannot derive the AES key.
          </div>
          <div>
            <Badge variant="blue">shared</Badge>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          <Button disabled={loading} onClick={onClose} variant="ghost">Cancel</Button>
          {recipientMatch ? (
            <>
              <Button disabled={loading} onClick={resetLookup} variant="default">Reset</Button>
              <Button disabled={loading} onClick={executeShare} variant="primary">
                {loading ? 'Sharing...' : 'Confirm'}
              </Button>
            </>
          ) : (
            <Button disabled={loading || !recipientQuery.trim()} onClick={lookupRecipient} variant="primary">
              {loading ? 'Looking up...' : 'Continue'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
