import { useState } from 'react';
import { CloudUpload, X, Clock, Eye } from 'lucide-react';
import { Button, Input, Label } from '../components/ui';

export default function UploadModal({ onUpload, onClose }) {
  const [file, setFile] = useState(null);
  const [selfDestructViews, setSelfDestructViews] = useState('');
  const [selfDestructAt, setSelfDestructAt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setLoading(true);
    try {
      await onUpload(file, {
        self_destruct_after_views: selfDestructViews || null,
        self_destruct_at: selfDestructAt || null
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        maxWidth: '440px',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          <X className="w-5 h-5" />
        </button>

        <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CloudUpload className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          Secure upload
        </h3>

        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ position: 'relative', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '24px', textAlign: 'center', background: 'var(--bg-elevated)' }}>
            <input
              type="file"
              onChange={handleFileChange}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
            {file ? (
              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Click or drag to select file</p>
                <p style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-tertiary)' }}>Max size 50MB</p>
              </div>
            )}
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
            <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Optional security settings</p>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <Label>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Eye className="w-3 h-3" />Self-destruct after views</span>
                </Label>
                <Input
                  type="number"
                  value={selfDestructViews}
                  onChange={(e) => setSelfDestructViews(e.target.value)}
                  placeholder="e.g. 1"
                  min="1"
                />
              </div>

              <div>
                <Label>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Clock className="w-3 h-3" />Auto-delete date</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={selfDestructAt}
                  onChange={(e) => setSelfDestructAt(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!file || loading} variant="primary" onClick={handleConfirm}>
            {loading ? 'Processing...' : 'Encrypt & Upload'}
          </Button>
        </div>
      </div>
    </div>
  );
}
