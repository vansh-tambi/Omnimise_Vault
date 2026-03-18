import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserCheck, Check, X, Plus, Send, Clock, Inbox, SendHorizontal } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import ApproveShareModal from '../vault/ApproveShareModal';
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader } from '../components/ui';

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
  const [approvingRequest, setApprovingRequest] = useState(null);

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
      if (action === 'rejected') {
        alert('Request rejected.');
      }
      if (res?.data?.message && action !== 'rejected') {
        alert(res.data.message);
      }
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update request.');
    } finally {
      setRespondingId(null);
    }
  };

  const handleApproveModalDone = (result, filename, recipientEmail) => {
    setApprovingRequest(null);
    if (result === 'approved-with-share') {
      alert(`Request approved and "${filename}" shared securely with ${recipientEmail}.`);
    } else if (result === 'approved-only') {
      alert('Request approved. The requester has been notified with vault access.');
    }
    fetchRequests();
  };

  const rows = activeTab === 'incoming' ? incomingRequests : outgoingRequests;

  const statusVariant = (status) => {
    if (status === 'pending') return 'amber';
    if (status === 'approved') return 'green';
    return 'red';
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <PageHeader
        title="Document Requests"
        subtitle="Approve or request secure document transfers"
        actions={
          <Button onClick={() => setShowForm((v) => !v)} variant="primary">
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        }
      />

      {showForm && (
        <Card style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>Request a document</h2>
          <div>
            <Label>Recipient Email or Account ID</Label>
            <Input
              type="text"
              value={targetIdentifier}
              onChange={(e) => setTargetIdentifier(e.target.value)}
              placeholder="colleague@example.com or 67f1..."
            />
          </div>
          <div>
            <Label>Document Type</Label>
            <Input
              type="text"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              placeholder="Passport, Pay Slip, ID Proof"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', resize: 'none' }}
              placeholder="Add context for the requester"
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <Button onClick={() => setShowForm(false)} variant="ghost">Cancel</Button>
            <Button onClick={handleSubmitRequest} disabled={submitting} variant="primary">
              <Send className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </Card>
      )}

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
          onClick={() => setActiveTab('incoming')}
          style={{
            padding: '6px 14px',
            borderRadius: 'calc(var(--radius-md) - 2px)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            background: activeTab === 'incoming' ? 'var(--bg-elevated)' : 'transparent',
            color: activeTab === 'incoming' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Inbox className="w-4 h-4" />
          Incoming
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          style={{
            padding: '6px 14px',
            borderRadius: 'calc(var(--radius-md) - 2px)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            background: activeTab === 'outgoing' ? 'var(--bg-elevated)' : 'transparent',
            color: activeTab === 'outgoing' ? 'var(--text-primary)' : 'var(--text-tertiary)',
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
        <div style={{ color: 'var(--text-secondary)' }}>Loading requests...</div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserCheck className="w-8 h-8" />}
            title={activeTab === 'incoming' ? 'No incoming requests' : 'No outgoing requests'}
            description="Requests will appear here when a teammate asks for secure document access."
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {rows.map((req) => {
            const isIncoming = activeTab === 'incoming';
            const isPendingIncoming = isIncoming && req.status === 'pending';
            const isHighlighted = highlightedRequestId === req.id;

            return (
              <Card
                key={req.id}
                style={{
                  borderColor: isHighlighted ? 'var(--border-strong)' : 'var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{req.document_type}</p>
                  {req.description && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{req.description}</p>
                  )}
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    {isIncoming ? (
                      <>
                        Requested by: <span style={{ color: 'var(--text-primary)' }}>{req.requester_email || req.requester_id}</span>
                      </>
                    ) : (
                      <>
                        Sent to: <span style={{ color: 'var(--text-primary)' }}>{req.target_user_email || req.target_user_id}</span>
                      </>
                    )}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <Clock className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{new Date(req.created_at).toLocaleString()}</span>
                    <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
                    {req.fulfilled_vault_id && (
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Vault: {req.fulfilled_vault_id.slice(-8)}</span>
                    )}
                  </div>
                </div>

                {isPendingIncoming && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                      onClick={() => setApprovingRequest(req)}
                      disabled={respondingId === req.id}
                      variant="success"
                      size="sm"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRespond(req.id, 'rejected')}
                      disabled={respondingId === req.id}
                      variant="danger"
                      size="sm"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {approvingRequest && (
        <ApproveShareModal
          request={approvingRequest}
          onClose={() => setApprovingRequest(null)}
          onApproved={handleApproveModalDone}
        />
      )}
    </div>
  );
}
