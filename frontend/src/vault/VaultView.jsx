import { useState, useEffect } from 'react';
import { FileText, Download, Share2, ShieldAlert, Trash2, Eye, CloudUpload } from 'lucide-react';
import api from '../services/api';
import { encryptFile, decryptFile, importPrivateKeyFromBase64, unwrapVaultKey, hashFile } from '../encryption/crypto';
import { useVaultKey } from '../context/VaultKeyContext';
import { useAuth } from '../hooks/useAuth';
import VaultPinPrompt from './VaultPinPrompt';
import ShareDocument from '../access/ShareDocument';
import UploadModal from './UploadModal';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState } from '../components/ui';

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
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <Card style={{ padding: '14px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {currentKey ? <Badge variant="accent">unlocked</Badge> : <Badge variant="default">locked</Badge>}
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {currentKey ? 'Vault unlocked. Operations are local and encrypted.' : 'Vault locked. Unlock to access encrypted documents.'}
            </span>
          </div>
          {currentKey && (
            <Button variant="primary" onClick={() => setShowUploadModal(true)}>
              <CloudUpload className="w-4 h-4" />
              Upload Document
            </Button>
          )}
        </div>
      </Card>
      
      {!currentKey && (
         <div style={{ marginBottom: '16px' }}>
            <VaultPinPrompt vaultId={vaultId} onKeyDerived={() => {}} />
         </div>
      )}

      {accessError ? (
        <Card>
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="Vault unavailable"
            description={accessError}
            action={<Link to="/access" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '12px' }}>Go to Shared with Me</Link>}
          />
        </Card>
      ) : !currentKey ? (
        <Card>
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="Documents hidden"
            description="Enter your vault PIN above to unlock and view your documents."
          />
        </Card>
      ) : loading ? (
        <div style={{ color: 'var(--text-secondary)', padding: '18px 0' }}>Loading secure documents...</div>
      ) : documents.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="Vault is empty"
            description="Upload sensitive files to keep them encrypted and accessible only by authorized users."
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {documents.map(doc => (
            <div
              key={doc.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <div style={{ color: 'var(--text-secondary)' }}>
                  <FileText className="w-4 h-4" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.filename}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                    {doc.content_type.split('/')[1] || doc.content_type} • {(doc.size_bytes / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => downloadDoc(doc, false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} title="View Document">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => downloadDoc(doc, true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Decrypt & Download">
                  <Download className="w-4 h-4" />
                </button>
                {currentKey && (
                  <button onClick={() => setSharingDoc(doc)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Share Document">
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => handleDeleteDoc(doc)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  title="Delete Document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </Card>
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
            <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--red)' }}>Document unavailable</h3>
            <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>{destructModalMessage}</p>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="danger" onClick={() => setDestructModalMessage('')}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
