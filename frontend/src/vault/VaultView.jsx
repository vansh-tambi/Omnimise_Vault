import { useState, useEffect } from 'react';
import { FileText, Download, Share2, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import UploadButton from '../components/UploadButton';
import { encryptFile, decryptFile, encryptKeyForRecipient, decryptKeyFromSender } from '../encryption/crypto';
import { useVaultKey } from '../context/VaultKeyContext';
import { useAuth } from '../hooks/useAuth';
import VaultPinPrompt from './VaultPinPrompt';

export default function VaultView({ vaultId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { vaultKey } = useVaultKey();
  const currentKey = vaultKey?.[vaultId];
  const { user } = useAuth();
  
  const [sharingDoc, setSharingDoc] = useState(null);
  const [recipientId, setRecipientId] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await api.get(`/documents?vault_id=${vaultId}`);
        setDocuments(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [vaultId]);

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('vault_id', vaultId);
    formData.append('file', file);

    try {
      // Zero-Knowledge Encryption Pipeline
      const { encrypted, iv } = await encryptFile(file, currentKey);
      
      // We must append IV to understand how to decrypt later
      const encryptedBlob = new Blob([iv, encrypted], { type: 'application/octet-stream' });
      
      const formData = new FormData();
      formData.append('vault_id', vaultId);
      // Pass original filename so UI knows what it is, even though content is encrypted
      formData.append('file', new File([encryptedBlob], file.name, { type: file.type }));

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDocuments(prev => [...prev, res.data]);
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    }
  };

  const downloadDoc = async (doc) => {
    try {
      let keyToUse = currentKey;
      
      // If no key in context (e.g. shared document or haven't unlocked yet), try fetching access list
      if (!keyToUse) {
        const accessRes = await api.get(`/access/list?document_id=${doc.id}`);
        const specificAccess = accessRes.data.find(a => a.shared_with === user?.id);
        
        if (specificAccess && specificAccess.encrypted_key_for_recipient) {
          const myPrivateKeyStr = localStorage.getItem('rsa_private_key');
          keyToUse = await decryptKeyFromSender(specificAccess.encrypted_key_for_recipient, myPrivateKeyStr);
        } else {
          alert("Vault is locked. Please unlock it using your PIN first.");
          return;
        }
      }

      const res = await api.get(`/documents/${doc.id}`);
      
      // Fetch encrypted blob
      const fileRes = await fetch(res.data.storage_url);
      const encryptedBuffer = await fileRes.arrayBuffer();
      
      // Extract IV (first 12 bytes)
      const iv = encryptedBuffer.slice(0, 12);
      const data = encryptedBuffer.slice(12);
      
      // Decrypt
      const decrypted = await decryptFile(data, new Uint8Array(iv), keyToUse);
      
      // Download 
      const blob = new Blob([decrypted], { type: doc.content_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to decrypt or retrieve document. Make sure you unlocked the vault or have valid shared access.");
    }
  };

  const executeShare = async () => {
    if (!recipientId || !sharingDoc || !currentKey) {
      alert("Cannot share: Missing recipient ID or Vault is locked (Unlock it first to wrap the key).");
      return;
    }
    setShareLoading(true);
    try {
      const pubKeyRes = await api.get(`/users/${recipientId}/public-key`);
      const wrappedKey = await encryptKeyForRecipient(currentKey, pubKeyRes.data.public_key);
      
      await api.post('/access/share', {
         document_id: sharingDoc.id,
         shared_with: recipientId,
         encrypted_key_for_recipient: wrappedKey,
         permission: "read"
      });
      alert('Document shared securely!');
      setSharingDoc(null);
      setRecipientId('');
    } catch(err) {
      console.error(err);
      alert('Failed to share document securely.');
    } finally {
      setShareLoading(false);
    }
  };

  // Only enforce VaultPinPrompt if vault is specifically requested to upload into and is locked
  // The user wanted VaultView to handle opening shared docs without the prompt blocking everything.

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-green-400 w-6 h-6" />
          <span className="text-sm text-gray-300">
             {currentKey ? "Vault Unlocked. Operations secure." : "Vault Locked. Downloads will attempt to use shared RSA wrapper."}
          </span>
        </div>
        {currentKey && <UploadButton onUpload={handleUpload} />}
      </div>
      
      {!currentKey && (
         <div className="mb-6">
            <VaultPinPrompt vaultId={vaultId} onKeyDerived={() => {}} />
         </div>
      )}

      {loading ? (
        <div className="text-center p-12 text-gray-400">Loading your secure documents...</div>
      ) : documents.length === 0 ? (
        <div className="card text-center p-16 border-dashed border-2">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">Vault is empty</h3>
          <p className="text-gray-400 max-w-sm mx-auto">Upload sensitive files to keep them secure and accessible only by you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <div key={doc.id} className="card p-4 flex items-center justify-between hover:bg-gray-800 transition">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="truncate pr-4">
                  <p className="font-medium text-gray-200 truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-500 capitalize">{doc.content_type.split('/')[1] || doc.content_type} • {(doc.size_bytes / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSharingDoc(doc)} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition" title="Share Access">
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={() => downloadDoc(doc)} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-blue-400 transition" title="Decrypt & Download">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {sharingDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md bg-gray-900 border-blue-500/30">
            <h3 className="text-xl font-bold text-white mb-2">Securely Share Document</h3>
            <p className="text-sm text-gray-400 mb-6 truncate">Sharing: {sharingDoc.filename}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Recipient User ID</label>
                <input 
                  type="text" 
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="input-field" 
                  placeholder="Paste user ID here..."
                />
              </div>
              <div className="text-xs text-blue-400/80 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                The vault key will be algorithmically wrapped using the recipient's RSA public key. The server cannot derive the AES key.
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button disabled={shareLoading} onClick={() => {setSharingDoc(null); setRecipientId('');}} className="btn-secondary">Cancel</button>
              <button disabled={shareLoading || !recipientId} onClick={executeShare} className="btn-primary">
                {shareLoading ? 'Sharing...' : 'Share Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
