import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, FileText, ShieldCheck, Calendar, SendHorizontal, Inbox } from 'lucide-react';
import api from '../services/api';
import { useVaultKey } from '../context/VaultKeyContext';
import { decryptFile, unwrapVaultKey, importPrivateKeyFromBase64, hashFile } from '../encryption/crypto';

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
    <div className="space-y-10">
      <div className="space-y-6 pt-2">
        <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
          <Link2 className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-semibold text-white">Shared Documents</h1>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 bg-gray-800/50 p-1 rounded-lg w-fit border border-gray-700">
          <button
            onClick={() => setActiveTab('received')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'received'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Shared with Me
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'sent'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <SendHorizontal className="w-4 h-4" />
            Outgoing
          </button>
        </div>

        {loading ? (
          <div className="text-gray-400">Syncing shared documents...</div>
        ) : activeTab === 'received' ? (
          receivedShares.length === 0 ? (
            <div className="card text-center p-12 text-gray-400 border-dashed border-2 flex flex-col items-center gap-3">
              <ShieldCheck className="w-12 h-12 text-gray-600" />
              No one has shared any documents with you yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
              {receivedShares.map(share => (
                <div
                  key={share.access_id}
                  onClick={() => openSharedDoc(share)}
                  className="card p-5 group hover:border-blue-500/50 transition cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 truncate">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500/20 transition shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="truncate">
                      <h4 className="text-white font-medium truncate">{share.filename}</h4>
                      <p className="text-xs text-gray-400">Owner: {share.owner_id?.slice(-8)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-col items-end shrink-0 ml-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(share.granted_at).toLocaleDateString()}
                    </span>
                    {share.expires_at && (
                      <span className="text-red-400/70 mt-1">Expires soon</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : sentShares.length === 0 ? (
          <div className="card text-center p-12 text-gray-400 border-dashed border-2 flex flex-col items-center gap-3">
            <SendHorizontal className="w-12 h-12 text-gray-600" />
            You haven't shared any documents yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {sentShares.map(share => (
              <div
                key={share.access_id}
                className="card p-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4 truncate">
                  <div className="p-3 bg-green-500/10 rounded-xl text-green-400 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="truncate">
                    <h4 className="text-white font-medium truncate">{share.filename}</h4>
                    <p className="text-xs text-gray-400">
                      Shared with:{' '}
                      <span className="text-gray-200">{share.shared_with_email || share.shared_with?.slice(-8)}</span>
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex flex-col items-end shrink-0 ml-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(share.granted_at).toLocaleDateString()}
                  </span>
                  {share.expires_at && (
                    <span className="text-red-400/70 mt-1">Expires soon</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
