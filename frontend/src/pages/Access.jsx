import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, FileText, ShieldCheck, Calendar, SendHorizontal, Inbox } from 'lucide-react';
import api from '../services/api';
import { useVaultKey } from '../context/VaultKeyContext';
import { decryptFile, unwrapVaultKey, importPrivateKeyFromBase64, hashFile } from '../encryption/crypto';
import { Badge, Card, EmptyState, PageHeader } from '../components/ui';

export default function Access() {
  const [receivedShares, setReceivedShares] = useState([]);
  const [sentShares, setSentShares] = useState([]);
  const [activeTab, setActiveTab] = useState('received');
  const [loading, setLoading] = useState(true);
  const { vaultKey } = useVaultKey();
  const [searchParams] = useSearchParams();
  const autoOpenRef = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recRes, sentRes] = await Promise.all([
          api.get('/access/received'),
          api.get('/access/sent'),
        ]);
        setReceivedShares(recRes.data);
        setSentShares(sentRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const docId = searchParams.get('docId');
    if (!docId || autoOpenRef.current || loading) {
      return;
    }
    const share = receivedShares.find((item) => item.document_id === docId);
    autoOpenRef.current = true;
    if (share) {
      openSharedDoc(share);
    } else {
      alert('This shared document is not available to your account.');
    }
  }, [receivedShares, searchParams, loading]);

  const openSharedDoc = async (share) => {
    try {
      // Try to get the wrapped key for this share and decrypt using stored private key
      const wrappedKeyBase64 = share.encrypted_key_for_recipient;
      if (!wrappedKeyBase64) {
        alert('No encrypted key found for this shared document.');
        return;
      }

      const privateKeyBase64 = localStorage.getItem('rsa_private_key');
      if (!privateKeyBase64) {
        alert('Your RSA private key is not available. Please log out and back in.');
        return;
      }

      const privateKey = await importPrivateKeyFromBase64(privateKeyBase64);
      const { unwrapVaultKey: unwrap } = await import('../encryption/crypto');
      const aesKey = await unwrapVaultKey(wrappedKeyBase64, privateKey);

      // Fetch the encrypted file
      const docRes = await api.get(`/documents/${share.document_id}`);
      const storageUrl = docRes.data.storage_url;

      let encryptedBuffer;
      if (storageUrl.startsWith('http://localhost') || storageUrl.startsWith('/')) {
        const fileRes = await api.get(storageUrl, { responseType: 'arraybuffer' });
        encryptedBuffer = fileRes.data;
      } else {
        const fileRes = await fetch(storageUrl);
        encryptedBuffer = await fileRes.arrayBuffer();
      }

      const decrypted = await decryptFile(encryptedBuffer, aesKey);

      const blob = new Blob([decrypted], { type: docRes.data.content_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error(err);
      alert('Failed to open document: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <PageHeader
        title="Shared Documents"
        subtitle="Files shared securely across vault boundaries"
      />

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          gap: '2px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '3px',
          marginBottom: '24px',
          width: 'fit-content',
        }}>
          <button
            onClick={() => setActiveTab('received')}
            style={{
              padding: '6px 14px',
              borderRadius: 'calc(var(--radius-md) - 2px)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              background: activeTab === 'received' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'received' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Inbox className="w-4 h-4" />
            Shared with Me
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            style={{
              padding: '6px 14px',
              borderRadius: 'calc(var(--radius-md) - 2px)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              background: activeTab === 'sent' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'sent' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <SendHorizontal className="w-4 h-4" />
            Outgoing
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-secondary)' }}>Syncing shared documents...</div>
        ) : activeTab === 'received' ? (
          receivedShares.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ShieldCheck className="w-8 h-8" />}
                title="No shared documents"
                description="No one has shared any documents with you yet."
              />
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {receivedShares.map(share => (
                <Card
                  key={share.access_id}
                  onClick={() => openSharedDoc(share)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ color: 'var(--text-primary)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{share.filename}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Owner: {share.owner_id?.slice(-8)}</p>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                      {new Date(share.granted_at).toLocaleDateString()}
                    </span>
                    <Badge variant="blue">shared</Badge>
                    {share.expires_at && (
                      <Badge variant="amber">pending</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : sentShares.length === 0 ? (
          <Card>
            <EmptyState
              icon={<SendHorizontal className="w-8 h-8" />}
              title="No outgoing shares"
              description="You haven't shared any documents yet."
            />
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {sentShares.map(share => (
              <Card
                key={share.access_id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ color: 'var(--text-primary)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{share.filename}</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      Shared with:{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{share.shared_with_email || share.shared_with?.slice(-8)}</span>
                    </p>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                    {new Date(share.granted_at).toLocaleDateString()}
                  </span>
                  <Badge variant="blue">shared</Badge>
                  {share.expires_at && (
                    <Badge variant="amber">pending</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
