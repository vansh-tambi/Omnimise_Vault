import { useState, useEffect } from 'react';
import api from '../services/api';
import { UserCheck, Check, X, Plus, Send, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import ShareDocument from '../access/ShareDocument';
import { useVaultKey } from '../context/VaultKeyContext';
import VaultPinPrompt from '../vault/VaultPinPrompt';
import UploadButton from '../components/UploadButton';
import { encryptFile, hashFile } from '../encryption/crypto';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { vaultKey } = useVaultKey();

  // New request form
  const [showForm, setShowForm] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [docType, setDocType] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ShareDocument modal for approvals
  const [shareContext, setShareContext] = useState(null); // { requesterEmail }
  const [myVaults, setMyVaults] = useState([]);
  const [selectedVault, setSelectedVault] = useState('');
  const [vaultDocs, setVaultDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    fetchRequests();
    api.get('/vault').then(r => setMyVaults(r.data)).catch(() => {});
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/requests');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!targetEmail.trim() || !docType.trim()) {
      alert('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/requests/create', {
        target_user_email: targetEmail.trim(),
        document_type: docType.trim(),
      });
      alert('Request sent!');
      setTargetEmail('');
      setDocType('');
      setShowForm(false);
      fetchRequests();
    } catch (err) {
      if (err.response?.status === 404) {
        alert('No user found with that email.');
      } else {
        alert('Failed to send request: ' + (err.response?.data?.detail || err.message));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post('/requests/respond', { request_id: id, action: 'rejected' });
      fetchRequests();
    } catch (err) {
      alert('Failed to reject request.');
    }
  };

  const handleApprove = async (req) => {
    // Approve and open ShareDocument flow
    try {
      const res = await api.post('/requests/respond', { request_id: req.id, action: 'approved' });
      const requesterEmail = res.data.requester_email || req.requester_id;
      setShareContext({ requesterEmail, requestId: req.id });
      fetchRequests();
    } catch (err) {
      alert('Failed to approve: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Load docs when vault selected in share flow
  useEffect(() => {
    if (!selectedVault) { setVaultDocs([]); setSelectedDoc(null); return; }
    api.get(`/documents?vault_id=${selectedVault}`).then(r => setVaultDocs(r.data)).catch(() => {});
  }, [selectedVault]);

  const currentVaultKey = vaultKey?.[selectedVault];

  const handleInlineUpload = async (file) => {
    if (!currentVaultKey || !selectedVault) return;
    try {
      const fileBuffer = await file.arrayBuffer();
      const fileHash = await hashFile(fileBuffer);

      const encryptedBuffer = await encryptFile(fileBuffer, currentVaultKey);
      const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });

      const formData = new FormData();
      formData.append('vault_id', selectedVault);
      formData.append('file', new File([encryptedBlob], file.name, { type: file.type }));
      formData.append('file_hash', fileHash);

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setVaultDocs(prev => [...prev, res.data]);
      setSelectedDoc(res.data); // Auto-select the newly uploaded doc
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const incoming = requests.filter(r => r.target_user_id && r.status !== undefined
    // will compare by checking context — backend filters this correctly, so we display all and label them
    && r.requester_id !== undefined
  );
  // Split by checking if this user is the target or requester
  // We don't have current user id here directly, so we use a heuristic:
  // incoming = those where requester_id != the logged-in user (target is logged-in user)
  // For simplicity we show all and label direction per request

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-gray-700 pb-4">
        <div className="flex items-center gap-3">
          <UserCheck className="w-6 h-6 text-gray-300" />
          <h1 className="text-2xl font-semibold text-white">Access Requests</h1>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {/* New Request Form */}
      {showForm && (
        <div className="card p-6 space-y-4 border border-blue-500/30">
          <h2 className="text-lg font-medium text-white">Request a Document</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Target User Email</label>
            <input
              type="email"
              value={targetEmail}
              onChange={e => setTargetEmail(e.target.value)}
              className="input-field w-full"
              placeholder="colleague@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Document Type / Description</label>
            <input
              type="text"
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. Passport, Pay Slip, ID Proof"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm transition">Cancel</button>
            <button
              onClick={handleSubmitRequest}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <div className="text-gray-400">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="card text-center p-12 text-gray-400 border-dashed border-2">
          No access requests yet. Click "New Request" to ask someone for a document.
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {requests.map(req => {
            const isIncoming = req.target_user_id === req.requester_id
              ? false
              : true; // Backend only returns requests where user is requester OR target
            // Determine direction from data
            const direction = req.requester_id && req.target_user_email ? 'check' : 'out';

            return (
              <div key={req.id} className="card p-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {req.target_user_email === targetEmail || !req.target_user_email ? (
                      <ArrowUpRight className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-purple-400 shrink-0" />
                    )}
                    <p className="text-white font-medium truncate">
                      {req.document_type}
                    </p>
                  </div>
                  <p className="text-sm text-gray-400">
                    From: <span className="text-gray-300">{req.requester_id?.slice(-8)}</span>
                    {req.target_user_email && (
                      <> → To: <span className="text-gray-300">{req.target_user_email}</span></>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-3 h-3 text-gray-600" />
                    <span className="text-xs text-gray-500">{new Date(req.created_at).toLocaleString()}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                      req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                      req.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>

                {/* Approve/Reject — only for incoming pending requests */}
                {req.status === 'pending' && req.target_user_email && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(req)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg text-sm transition"
                    >
                      <Check className="w-4 h-4" />
                      Accept & Share
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm transition"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Share Document modal after approving a request */}
      {shareContext && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg bg-gray-900 border-green-500/30 p-6 rounded-xl shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-white">Share Document with Requester</h3>
            <p className="text-sm text-gray-400">
              Request approved. Now pick which document to share with <span className="text-green-400">{shareContext.requesterEmail}</span>.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Select Vault</label>
              <select
                value={selectedVault}
                onChange={e => setSelectedVault(e.target.value)}
                className="input-field w-full"
              >
                <option value="">-- Choose a vault --</option>
                {myVaults.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {selectedVault && !currentVaultKey && (
              <div className="mt-4 border border-amber-500/20 rounded-lg p-2 bg-gray-800">
                <VaultPinPrompt vaultId={selectedVault} onKeyDerived={() => {}} />
              </div>
            )}

            {selectedVault && currentVaultKey && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Select Document</label>
                  <UploadButton onUpload={handleInlineUpload} />
                </div>
                
                {vaultDocs.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-6 border border-dashed border-gray-700 rounded-lg">
                    This vault is empty. Upload a new document above.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                  {vaultDocs.map(doc => (
                    <label key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      selectedDoc?.id === doc.id ? 'border-green-500/60 bg-green-500/10' : 'border-gray-700 hover:border-gray-500'
                    }`}>
                      <input
                        type="radio"
                        name="share_doc"
                        checked={selectedDoc?.id === doc.id}
                        onChange={() => setSelectedDoc(doc)}
                        className="accent-green-500"
                      />
                      <span className="text-gray-200 text-sm">{doc.filename}</span>
                    </label>
                  ))}
                  </div>
                )}
              </div>
            )}

            {selectedDoc && currentVaultKey && (
              <ShareDocument
                document={selectedDoc}
                currentKey={currentVaultKey}
                onClose={() => { setShareContext(null); setSelectedDoc(null); setSelectedVault(''); }}
                onSuccess={() => { setShareContext(null); setSelectedDoc(null); setSelectedVault(''); }}
                prefillEmail={shareContext.requesterEmail}
              />
            )}

            {!selectedDoc && (
              <div className="flex justify-end">
                <button
                  onClick={() => { setShareContext(null); setSelectedVault(''); setSelectedDoc(null); }}
                  className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm transition"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
