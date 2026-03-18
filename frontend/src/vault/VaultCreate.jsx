import { useState } from 'react';
import { useVault } from '../hooks/useVault';
import { Plus } from 'lucide-react';
import { Button, Card, Input, Label } from '../components/ui';

export default function VaultCreate({ onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { createVault, loading } = useVault();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !pin.trim()) return;
    if (pin !== confirmPin) {
      alert("PINs do not match!");
      return;
    }
    try {
      const newVault = await createVault(name, description, pin);
      setIsOpen(false);
      setName('');
      setDescription('');
      setPin('');
      setConfirmPin('');
      if (onCreated) onCreated(newVault);
    } catch (error) {
      console.error(error);
      alert('Failed to create vault.');
    }
  };

  if (!isOpen) {
    return (
      <Card onClick={() => setIsOpen(true)} style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '10px',
          color: 'var(--text-secondary)',
        }}>
          <Plus className="w-4 h-4" />
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>Create new vault</span>
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>New secure vault</h3>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
        <div>
          <Label>Vault Name *</Label>
          <Input
            type="text" 
            placeholder="e.g. Finance Docs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
            autoFocus
          />
        </div>
        <div>
          <Label>Description</Label>
          <textarea 
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '9px 12px', color: 'var(--text-primary)', minHeight: '50px', fontFamily: 'var(--font-sans)', fontSize: '13px' }}
            placeholder="Optional purpose description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <Label>Master PIN *</Label>
          <Input
            type="password" 
            placeholder="Choose a PIN to secure this vault"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={loading}
            required
            minLength={4}
          />
        </div>
        <div>
          <Label>Confirm PIN *</Label>
          <Input
            type="password" 
            placeholder="Confirm your Master PIN"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            disabled={loading}
            required
            minLength={4}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <Button type="button" onClick={() => setIsOpen(false)} variant="ghost" disabled={loading}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={loading || !name}>
            {loading ? 'Creating...' : 'Create Vault'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
