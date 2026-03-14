import { useState } from 'react';
import { useVault } from '../hooks/useVault';
import { Plus } from 'lucide-react';

export default function VaultCreate({ onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { createVault, loading } = useVault();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const newVault = await createVault(name, description);
      setIsOpen(false);
      setName('');
      setDescription('');
      if (onCreated) onCreated(newVault);
    } catch (error) {
      console.error(error);
      alert('Failed to create vault.');
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="card flex flex-col items-center justify-center border-dashed border-2 hover:bg-gray-800 transition cursor-pointer hover:border-blue-500 text-gray-400 hover:text-white group min-h-[200px]">
        <div className="p-4 rounded-full bg-gray-800 group-hover:bg-blue-600/20 mb-4 transition">
          <Plus className="w-8 h-8 group-hover:text-blue-400" />
        </div>
        <span className="font-semibold text-lg">Create New Vault</span>
      </button>
    );
  }

  return (
    <div className="card border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
      <h3 className="text-xl font-semibold mb-4 text-white">New Secure Vault</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Vault Name *</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="e.g. Finance Docs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <textarea 
            className="input-field min-h-[80px]" 
            placeholder="Optional purpose description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button type="button" onClick={() => setIsOpen(false)} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !name}>
            {loading ? 'Creating...' : 'Create Vault'}
          </button>
        </div>
      </form>
    </div>
  );
}
