import { Folder, ChevronRight, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VaultCard({ vault }) {
  return (
    <Link 
      to={`/vault/${vault.id}`}
      className="card group hover:scale-105 hover:bg-gray-800 transition shadow-md hover:shadow-xl cursor-pointer flex flex-col justify-between"
    >
      <div className="flex items-start justify-between">
        <div className="p-3 bg-gray-800 group-hover:bg-gray-700 rounded-lg">
          <Folder className="w-8 h-8 text-blue-400" />
        </div>
        <Lock className="w-4 h-4 text-gray-500" />
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
