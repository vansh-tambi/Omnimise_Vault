import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserCheck, Check, X, Plus, Send, Clock, Inbox, SendHorizontal } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function Requests() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightedRequestId = searchParams.get('requestId');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('incoming');

  const [showForm, setShowForm] = useState(false);
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [docType, setDocType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [respondingId, setRespondingId] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/requests');
      setRequests(res.data || []);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (!highlightedRequestId) {
      return;
    }
    const isIncoming = requests.some(
      (r) => r.id === highlightedRequestId && r.target_user_id === user?.id
    );
    setActiveTab(isIncoming ? 'incoming' : 'outgoing');
  }, [highlightedRequestId, requests, user]);

  const incomingRequests = useMemo(
    () => requests.filter((r) => r.target_user_id === user?.id),
    [requests, user]
  );

  const outgoingRequests = useMemo(
    () => requests.filter((r) => r.requester_id === user?.id),
    [requests, user]
  );

  const handleSubmitRequest = async () => {
    if (!targetIdentifier.trim() || !docType.trim()) {
      alert('Please provide recipient and document type.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/requests', {
        target_identifier: targetIdentifier.trim(),
        document_type: docType.trim(),
        description: description.trim() || null,
      });
      alert('Request sent.');
      setTargetIdentifier('');
      setDocType('');
      setDescription('');
      setShowForm(false);
      setActiveTab('outgoing');
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (requestId, action) => {
    setRespondingId(requestId);
    try {
      const res = await api.post('/requests/respond', { request_id: requestId, action });
      if (action === 'approved') {
        alert('Request approved. The requester has been notified with vault access.');
      }
      if (action === 'rejected') {
        alert('Request rejected.');
      }
      if (res?.data?.message && action !== 'approved' && action !== 'rejected') {
        alert(res.data.message);
      }
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update request.');
    } finally {
      setRespondingId(null);
    }
  };

  const rows = activeTab === 'incoming' ? incomingRequests : outgoingRequests;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-gray-700 pb-4">
        <div className="flex items-center gap-3">
          <UserCheck className="w-6 h-6 text-gray-300" />
          <h1 className="text-2xl font-semibold text-white">Document Requests</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {showForm && (
        <div className="card p-6 space-y-4 border border-blue-500/30">
          <h2 className="text-lg font-medium text-white">Request a Document</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Recipient Email or Account ID</label>
            <input
              type="text"
              value={targetIdentifier}
              onChange={(e) => setTargetIdentifier(e.target.value)}
              className="input-field w-full"
              placeholder="colleague@example.com or 67f1..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Document Type</label>
            <input
              type="text"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="input-field w-full"
              placeholder="Passport, Pay Slip, ID Proof"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input-field w-full resize-none"
              placeholder="Add context for the requester"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm transition"
            >
              Cancel
            </button>
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

      <div className="flex items-center gap-2 bg-gray-800/50 p-1 rounded-lg w-fit border border-gray-700">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'incoming'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Incoming
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'outgoing'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <SendHorizontal className="w-4 h-4" />
          Outgoing
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading requests...</div>
      ) : rows.length === 0 ? (
        <div className="card text-center p-12 text-gray-400 border-dashed border-2">
          {activeTab === 'incoming' ? 'No incoming requests.' : 'No outgoing requests.'}
        </div>
      ) : (
        <div className="space-y-3 max-w-4xl">
          {rows.map((req) => {
            const isIncoming = activeTab === 'incoming';
            const isPendingIncoming = isIncoming && req.status === 'pending';
            const isHighlighted = highlightedRequestId === req.id;

            return (
              <div
                key={req.id}
                className={`card p-5 flex items-start justify-between gap-4 ${
                  isHighlighted ? 'border border-blue-500/60' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{req.document_type}</p>
                  {req.description && (
                    <p className="text-sm text-gray-400 mt-1">{req.description}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-2">
                    {isIncoming ? (
                      <>
                        Requested by: <span className="text-gray-200 break-all">{req.requester_email || req.requester_id}</span>
                      </>
                    ) : (
                      <>
                        Sent to: <span className="text-gray-200 break-all">{req.target_user_email || req.target_user_id}</span>
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-3 h-3 text-gray-600" />
                    <span className="text-xs text-gray-500">{new Date(req.created_at).toLocaleString()}</span>
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                        req.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : req.status === 'approved'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {req.status}
                    </span>
                    {req.fulfilled_vault_id && (
                      <span className="text-xs text-gray-400">Vault: {req.fulfilled_vault_id.slice(-8)}</span>
                    )}
                  </div>
                </div>

                {isPendingIncoming && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRespond(req.id, 'approved')}
                      disabled={respondingId === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleRespond(req.id, 'rejected')}
                      disabled={respondingId === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm transition disabled:opacity-50"
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
    </div>
  );
}
