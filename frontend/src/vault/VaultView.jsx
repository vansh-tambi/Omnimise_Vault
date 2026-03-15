import { useState, useEffect } from 'react';
import { FileText, Download, Share2, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import UploadButton from '../components/UploadButton';
import { encryptFile, decryptFile, importPrivateKeyFromBase64, unwrapVaultKey, hashFile } from '../encryption/crypto';
import { useVaultKey } from '../context/VaultKeyContext';
import { useAuth } from '../hooks/useAuth';
import VaultPinPrompt from './VaultPinPrompt';
import ShareDocument from '../access/ShareDocument';

export default function VaultView({ vaultId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { vaultKey } = useVaultKey();
  const currentKey = vaultKey?.[vaultId];
  const { user } = useAuth();
  
  const [sharingDoc, setSharingDoc] = useState(null);
  const [recipientId, setRecipientId] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  
  const [uploadOptions, setUploadOptions] = useState({ selfDestructViews: '', selfDestructDate: '' });

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
      const fileBuffer = await file.arrayBuffer();
      const fileHash = await hashFile(fileBuffer);
      
      const { encrypted, iv } = await encryptFile(file, currentKey);
      
      // We must append IV to understand how to decrypt later
      const encryptedBlob = new Blob([iv, encrypted], { type: 'application/octet-stream' });
      
      const formData = new FormData();
      formData.append('vault_id', vaultId);
      // Pass original filename so UI knows what it is, even though content is encrypted
      formData.append('file', new File([encryptedBlob], file.name, { type: file.type }));
      formData.append('file_hash', fileHash);
      
      if (uploadOptions.selfDestructViews) {
         formData.append('self_destruct_after_views', uploadOptions.selfDestructViews);
      }
      if (uploadOptions.selfDestructDate) {
         formData.append('self_destruct_at', new Date(uploadOptions.selfDestructDate).toISOString());
      }

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDocuments(prev => [...prev, res.data]);
      setUploadOptions({ selfDestructViews: '', selfDestructDate: '' });
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
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
          const myPrivateKeyB64 = sessionStorage.getItem('rsa_private_key');
          if (!myPrivateKeyB64) {
            alert("RSA Private Key not found securely in session. Please unlock any owned vault first to initialize keys.");
            return;
          }
          const privateKeyObj = await importPrivateKeyFromBase64(myPrivateKeyB64);
          keyToUse = await unwrapVaultKey(specificAccess.encrypted_key_for_recipient, privateKeyObj);
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
      
      const computedHash = await hashFile(decrypted);
      if (doc.file_hash && computedHash !== doc.file_hash) {
        alert("Integrity check failed. This file may have been tampered with and has not been downloaded.");
        return;
      }
      
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
      if (err.response?.status === 410) {
        alert("This document no longer exists. It was permanently destroyed as configured.");
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
      } else {
        alert("Failed to decrypt or retrieve document. Make sure you unlocked the vault or have valid shared access.");
      }
    }
  };

  const handleCloseShare = () => {
    setSharingDoc(null);
  };

  // Only enforce VaultPinPrompt if vault is specifically requested to upload into and is locked
  // The user wanted VaultView to handle opening shared docs without the prompt blocking everything.

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-green-400 w-6 h-6" />
            <span className="text-sm text-gray-300">
               {currentKey ? "Vault Unlocked. Operations secure." : "Vault Locked. Downloads will attempt to use shared RSA wrapper."}
            </span>
          </div>
          {currentKey && <UploadButton onUpload={handleUpload} />}
        </div>
        
        {currentKey && (
          <div className="flex flex-col sm:flex-row gap-4 border-t border-gray-700 pt-4 mt-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">Self-destruct after N views</label>
              <input 
                type="number" 
                value={uploadOptions.selfDestructViews}
                onChange={(e) => setUploadOptions(prev => ({ ...prev, selfDestructViews: e.target.value }))}
                className="input-field w-full py-1 text-sm field-sizing-sm" 
                placeholder="Optional max views"
                min="1"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">Auto-delete after date</label>
              <input 
                type="datetime-local" 
                value={uploadOptions.selfDestructDate}
                onChange={(e) => setUploadOptions(prev => ({ ...prev, selfDestructDate: e.target.value }))}
                className="input-field w-full py-1 text-sm field-sizing-sm text-gray-300" 
              />
            </div>
            <div className="flex-1 flex text-xs text-blue-400/80 items-center px-2">
              Values above apply to the next file selected via Upload File.
            </div>
          </div>
        )}
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
        <ShareDocument 
          document={sharingDoc} 
          currentKey={currentKey} 
          onClose={handleCloseShare} 
        />
      )}
    </div>
  );
}
