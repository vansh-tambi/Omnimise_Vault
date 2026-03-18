import { useState, useEffect } from 'react';
import { X, Check, FileText, Lock, KeyRound, Eye, EyeOff, FolderOpen, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useVaultKey } from '../context/VaultKeyContext';
import { Link } from 'react-router-dom';
import {
  importPublicKeyFromBase64,
  wrapVaultKey,
} from '../encryption/crypto';
import { Badge, Button, Input, Label } from '../components/ui';

export default function ApproveShareModal({ request, onClose, onApproved }) {
  const { vaultKey, unlockVault } = useVaultKey();
  const [userVaults, setUserVaults] = useState([]);
  const [selectedVaultId, setSelectedVaultId] = useState(null);
  const [vaultDocs, setVaultDocs] = useState([]);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingVaults, setFetchingVaults] = useState(true);

  // PIN unlock state
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    const fetchVaults = async () => {
      try {
        const res = await api.get('/vault');
        const vaults = res.data || [];
        setUserVaults(vaults);
        const unlocked = vaults.find((v) => vaultKey?.[v.id]);
        setSelectedVaultId(unlocked?.id || vaults[0]?.id || null);
      } catch (err) {
        console.error(err);
      } finally {
        setFetchingVaults(false);
      }
    };
    fetchVaults();
  }, []);

  // Reset state when user switches vault
  useEffect(() => {
    setPin('');
    setPinError('');
    setSelectedDoc(null);
    setVaultDocs([]);
  }, [selectedVaultId]);

  // Fetch documents once the vault is unlocked
  useEffect(() => {
    if (!selectedVaultId || !currentKey) return;
    const fetchDocs = async () => {
      setFetchingDocs(true);
      try {
        const res = await api.get(`/documents?vault_id=${selectedVaultId}`);
        setVaultDocs(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setFetchingDocs(false);
      }
    };
    fetchDocs();
  }, [selectedVaultId, vaultKey]);

  const currentKey = selectedVaultId ? vaultKey?.[selectedVaultId] : null;

  const handleUnlockVault = async (e) => {
    e.preventDefault();
    if (!pin || !selectedVaultId) return;
    setUnlocking(true);
    setPinError('');
    try {
      await unlockVault(selectedVaultId, pin);
      setPin('');
    } catch (err) {
      setPinError('Incorrect PIN. Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleApproveOnly = async () => {
    setLoading(true);
    try {
      await api.post('/requests/respond', { request_id: request.id, action: 'approved' });
      onApproved('approved-only');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndShare = async () => {
    if (!selectedDoc) {
      alert('Please select a document from the vault to share.');
      return;
    }
    if (!currentKey) {
      alert('Please unlock the vault with your PIN before sharing a document.');
      return;
    }

    setLoading(true);
    try {
      // 1. Look up the requester's RSA public key
      const requesterIdentifier = request.requester_email || request.requester_id;
      const userRes = await api.get(
        `/access/lookup_user?query=${encodeURIComponent(requesterIdentifier)}`
      );
      const { user_id: recipientId, rsa_public_key } = userRes.data;

      // 2. Wrap vault AES key with recipient's RSA public key (zero-knowledge)
      // The doc is already encrypted with this vault key — we just share the key wrapper
      const recipientPublicKey = await importPublicKeyFromBase64(rsa_public_key);
      const wrappedKey = await wrapVaultKey(currentKey, recipientPublicKey);

      // 3. Create the access/share record for the existing vault document
      await api.post('/access/share', {
        document_id: selectedDoc.id,
        shared_with: recipientId,
        encrypted_key_for_recipient: wrappedKey,
        permission: 'read',
      });

      // 4. Approve the request
      await api.post('/requests/respond', { request_id: request.id, action: 'approved' });

      onApproved('approved-with-share', selectedDoc.filename, requesterIdentifier);
    } catch (err) {
      console.error(err);
      alert('Failed: ' + (err.response?.data?.detail || err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const selectedVaultName = userVaults.find((v) => v.id === selectedVaultId)?.name || '';

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
        maxWidth: '560px',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          disabled={loading}
          style={{ position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
        >
          <X className="w-5 h-5" />
        </button>

        <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check className="w-4 h-4" style={{ color: 'var(--green)' }} />
          Approve Request
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          Approving{' '}
          <span style={{ color: 'var(--text-primary)' }}>{request.document_type}</span> requested by{' '}
          <span style={{ color: 'var(--text-secondary)' }}>{request.requester_email || request.requester_id}</span>
        </p>
        <div style={{ marginBottom: '14px' }}><Badge variant="amber">pending</Badge></div>

        {/* No vault state */}
        {!fetchingVaults && userVaults.length === 0 && (
          <div className="mb-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-200">
              No vault created yet. First create a vault and upload the required document in it.
            </p>
            <Link
              to="/"
              onClick={onClose}
              className="mt-3 inline-flex items-center rounded-lg bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-500 transition"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {/* Vault selector — always visible */}
        {!fetchingVaults && userVaults.length > 0 && (
          <div className="mb-4">
            <Label>Choose source vault</Label>
            <select
              value={selectedVaultId || ''}
              onChange={(e) => setSelectedVaultId(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px' }}
              disabled={loading || unlocking}
            >
              {userVaults.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}{vaultKey?.[v.id] ? ' ✓ Unlocked' : ' 🔒 Locked'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Inline PIN unlock — shown when selected vault is locked */}
        {!fetchingVaults && selectedVaultId && !currentKey && (
          <div className="mb-4 p-4 rounded-xl bg-gray-800/60 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-yellow-400 shrink-0" />
              <p className="text-sm text-yellow-300 font-medium">
                "{selectedVaultName}" is locked — enter your PIN to unlock it
              </p>
            </div>
            <form onSubmit={handleUnlockVault} className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setPinError(''); }}
                  style={{ paddingRight: '36px', fontFamily: 'var(--font-mono)', letterSpacing: '0.2em' }}
                  placeholder="Enter vault PIN"
                  disabled={unlocking}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" disabled={unlocking || !pin} variant="default">
                {unlocking ? 'Unlocking…' : 'Unlock'}
              </Button>
            </form>
            {pinError && (
              <p className="mt-2 text-xs text-red-400">{pinError}</p>
            )}
          </div>
        )}

        {/* Vault document browser — shown once vault is unlocked */}
        {currentKey && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Select document from "{selectedVaultName}"
              </label>
            </div>

            {fetchingDocs ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading vault documents…
              </div>
            ) : vaultDocs.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-700 rounded-xl">
                No documents found in this vault.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {vaultDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
                      selectedDoc?.id === doc.id
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                    }`}
                  >
                    <FileText className={`w-4 h-4 shrink-0 ${selectedDoc?.id === doc.id ? 'text-blue-400' : 'text-gray-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-gray-500">{(doc.size_bytes / 1024).toFixed(1)} KB</p>
                    </div>
                    {selectedDoc?.id === doc.id && (
                      <Check className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleApproveAndShare}
            disabled={loading || !selectedDoc || !currentKey || userVaults.length === 0}
            variant="success"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Check className="w-4 h-4" />
            {loading ? 'Processing…' : selectedDoc ? `Share "${selectedDoc.filename}"` : 'Approve & Share Document'}
          </Button>
          <Button
            onClick={handleApproveOnly}
            disabled={loading}
            variant="default"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Check className="w-4 h-4" />
            {loading ? '...' : 'Approve Only (no document)'}
          </Button>
        </div>
      </div>
    </div>
  );
}
