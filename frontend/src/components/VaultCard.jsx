import { Folder, ChevronRight, Lock, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function VaultCard({ vault, onDeleted }) {
  const handleDelete = async (e) => {
    e.preventDefault(); // Stop click from bubbling to Link
    e.stopPropagation();
    
    if (!window.confirm(`Are you sure you want to delete "${vault.name}"? This will permanently remove all documents inside this vault.`)) {
      return;
    }
    
    try {
      await api.delete(`vault/${vault.id}`);
      if (onDeleted) onDeleted(vault.id);
    } catch (err) {
      console.error("Failed to delete vault", err);
      alert("Failed to delete vault. Please try again.");
    }
  };

  return (
    <Link 
      to={`/vault/${vault.id}`}
      className="card group hover:scale-105 hover:bg-gray-800 transition shadow-md hover:shadow-xl cursor-pointer flex flex-col justify-between relative"
    >
      <div className="flex items-start justify-between">
        <div className="p-3 bg-gray-800 group-hover:bg-gray-700 rounded-lg">
          <Folder className="w-8 h-8 text-blue-400" />
        </div>
        <div className="flex items-center gap-2">
            <button 
              onClick={handleDelete}
              className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
              title="Delete Vault"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <Lock className="w-4 h-4 text-gray-500" />
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition">{vault.name}</h3>
        <p className="text-sm text-gray-400 mt-1 line-clamp-2">
          {vault.description || 'Secure document storage'}
        </p>
      </div>
      <div className="mt-6 flex items-center text-sm font-medium text-blue-500 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        Open Vault <ChevronRight className="w-4 h-4 ml-1" />
      </div>
    </Link>
  );
}
