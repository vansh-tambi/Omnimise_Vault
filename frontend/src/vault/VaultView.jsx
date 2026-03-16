import { useState, useEffect } from 'react';
import { FileText, Download, Share2, ShieldAlert, Trash2, Eye, CloudUpload } from 'lucide-react';
import api from '../services/api';
import UploadButton from '../components/UploadButton';
import { encryptFile, decryptFile, importPrivateKeyFromBase64, unwrapVaultKey, hashFile } from '../encryption/crypto';
import { useVaultKey } from '../context/VaultKeyContext';
import { useAuth } from '../hooks/useAuth';
import VaultPinPrompt from './VaultPinPrompt';
import ShareDocument from '../access/ShareDocument';
import UploadModal from './UploadModal';
import { Link } from 'react-router-dom';

export default function VaultView({ vaultId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [destructModalMessage, setDestructModalMessage] = useState('');
  const { vaultKey } = useVaultKey();
  const currentKey = vaultKey?.[vaultId];
  const { user } = useAuth();

  const [sharingDoc, setSharingDoc] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);



  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await api.get(`/documents?vault_id=${vaultId}`);
        setDocuments(res.data);
        setAccessError('');
      } catch (err) {
        const status = err.response?.status;
        if (status === 403) {
          setAccessError('You do not have access to this vault. If this is a shared document, open it from Shared with Me.');
        } else if (status === 404) {
          setAccessError('This vault was not found or has been removed.');
        } else {
          setAccessError('Failed to load vault documents. Please try again.');
        }
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [vaultId]);

  const handleUpload = async (file, options = {}) => {
    try {
      // Zero-Knowledge Encryption Pipeline
      const fileBuffer = await file.arrayBuffer();
      const fileHash = await hashFile(fileBuffer);

      const encryptedBuffer = await encryptFile(fileBuffer, currentKey);

      // IV is now encapsulated automatically inside the returning array buffer by crypto.js
      const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });

      const formData = new FormData();
      formData.append('vault_id', vaultId);
      formData.append('file', new File([encryptedBlob], file.name, { type: file.type }));
      formData.append('file_hash', fileHash);
      
      if (options.self_destruct_after_views) formData.append('self_destruct_after_views', options.self_destruct_after_views);
      if (options.self_destruct_at) formData.append('self_destruct_at', options.self_destruct_at);

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDocuments(prev => [...prev, res.data]);
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const downloadDoc = async (doc, forceDownload = false) => {
    if (!currentKey) {
      alert('Vault is locked. Enter your PIN to unlock and then access documents.');
      return;
    }
    try {
      // ... existing decryption logic ...
      const res = await api.get(`documents/${doc.id}`);
      const storageUrl = res.data.storage_url;
      
      let encryptedBuffer;
      if (storageUrl.startsWith('http://localhost') || storageUrl.startsWith('/')) {
        const fileRes = await api.get(storageUrl, { responseType: 'arraybuffer' });
        encryptedBuffer = fileRes.data;
      } else {
        const fileRes = await fetch(storageUrl);
        if (!fileRes.ok) throw new Error(`File fetch failed: ${fileRes.status}`);
        encryptedBuffer = await fileRes.arrayBuffer();
      }
      
      // IV unboxing and decryption are now encapsulated in crypto.js
      const decrypted = await decryptFile(encryptedBuffer, currentKey);
      
      const computedHash = await hashFile(decrypted);
      if (doc.file_hash && computedHash !== doc.file_hash) {
        alert('Integrity check failed. This file may have been tampered with.');
        return;
      }
      
      // Open or Download
      const blob = new Blob([decrypted], { type: doc.content_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      if (forceDownload) {
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // Open in new tab — use anchor with target=_blank to bypass popup blocker
        // (window.open after await is treated as a popup by Chrome/Firefox)
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      // Clean up after a delay so it has time to open
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      
    } catch (err) {
      console.error('Access failed:', err);
      if (err.response?.status === 410) {
        const detail = err.response?.data?.detail;
        const message = typeof detail === 'string' ? detail : 'This document was permanently destroyed.';
        setDestructModalMessage(message);
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
      } else {
        alert('Failed to access document: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.filename}"?`)) {
      return;
    }
    
    try {
      await api.delete(`documents/${doc.id}`);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error("Failed to delete document", err);
      alert("Failed to delete document. Please try again.");
    }
  };

  const handleCloseShare = () => setSharingDoc(null);



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
          {currentKey && (
            <button 
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition shadow-lg shadow-blue-500/20 flex items-center gap-2"
            >
              <CloudUpload className="w-4 h-4" />
              Upload Document
            </button>
          )}
        </div>
      </div>
      
      {!currentKey && (
         <div className="mb-6">
            <VaultPinPrompt vaultId={vaultId} onKeyDerived={() => {}} />
         </div>
      )}

      {accessError ? (
        <div className="card text-center p-12 border-dashed border-2 border-gray-700">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">Vault Unavailable</h3>
          <p className="text-gray-400 max-w-sm mx-auto">{accessError}</p>
          <div className="mt-4">
            <Link to="/access" className="text-blue-400 hover:text-blue-300 underline">Go to Shared with Me</Link>
          </div>
        </div>
      ) : !currentKey ? (
        <div className="card text-center p-16 border-dashed border-2 border-gray-700">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">Documents Hidden</h3>
          <p className="text-gray-400 max-w-sm mx-auto">Enter your vault PIN above to unlock and view your documents.</p>
        </div>
      ) : loading ? (
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
                  <p className="text-xs text-gray-500 capitalize">
                    {doc.content_type.split('/')[1] || doc.content_type} • {(doc.size_bytes / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadDoc(doc, false)} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-green-400 transition" title="View Document">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => downloadDoc(doc, true)} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-blue-400 transition" title="Decrypt & Download">
                  <Download className="w-4 h-4" />
                </button>
                {currentKey && (
                  <button onClick={() => setSharingDoc(doc)} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-purple-400 transition" title="Share Document">
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => handleDeleteDoc(doc)} 
                  className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition" 
                  title="Delete Document"
                >
                  <Trash2 className="w-4 h-4" />
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

      {showUploadModal && (
        <UploadModal 
          onUpload={handleUpload} 
          onClose={() => setShowUploadModal(false)} 
        />
      )}

      {destructModalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-gray-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-red-300">Document Unavailable</h3>
            <p className="mt-3 text-sm text-gray-200">{destructModalMessage}</p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setDestructModalMessage('')}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
