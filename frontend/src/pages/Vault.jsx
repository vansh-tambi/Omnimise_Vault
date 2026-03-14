import { useParams, useNavigate } from 'react-router-dom';
import VaultView from '../vault/VaultView';
import { ArrowLeft } from 'lucide-react';

export default function Vault() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition">
           <ArrowLeft className="w-5 h-5"/>
        </button>
        <h1 className="text-2xl font-semibold text-white">Vault Explorer</h1>
      </div>
      
      <div className="mt-6">
        <VaultView vaultId={id} />
      </div>
    </div>
  );
}
