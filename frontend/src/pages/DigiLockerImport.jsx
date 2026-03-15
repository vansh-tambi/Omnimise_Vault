import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useVaultKey } from '../context/VaultKeyContext';
import { useVault } from '../hooks/useVault';
import { encryptFile } from '../encryption/crypto';
import { DownloadCloud, ArrowLeft, ShieldAlert, FileText, Loader2 } from 'lucide-react';

export default function DigiLockerImport() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importingUri, setImportingUri] = useState(null);
  const [selectedVault, setSelectedVault] = useState('');
  
  const { vaultKey } = useVaultKey();
  const { vaults } = useVault();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDigiDocs = async () => {
      try {
        const res = await api.get('/digilocker/documents');
        // DigiLocker returns docs mapping inside an items array per standard specs
        setDocs(res.data.items || res.data || []);
      } catch (err) {
        console.error(err);
        // If 401/unconnected, redirect to dashboard or show error
      } finally {
        setLoading(false);
      }
    };
    fetchDigiDocs();
  }, []);

  const handleImport = async (doc) => {
    if (!selectedVault) {
      alert("Please select a target vault first.");
      return;
    }
    const currentKey = vaultKey?.[selectedVault];
    if (!currentKey) {
      alert("Target vault is locked. Please unlock it from the dashboard first to perform zero-knowledge imports.");
      return;
    }

    setImportingUri(doc.uri);
    try {
      // 1. Fetch raw bytes from DigiLocker via our secure streaming backend proxy
      const downloadRes = await api.post(`/digilocker/import/${encodeURIComponent(doc.uri)}`, {}, {
        responseType: 'blob'
      });
      
      // 2. Wrap blob cleanly into a File
      const rawFile = new File([downloadRes.data], `${doc.name}.pdf`, { type: 'application/pdf' });
      
      // 3. Encrypt entirely client side
      const { encrypted, iv } = await encryptFile(rawFile, currentKey);
      const encryptedBlob = new Blob([iv, encrypted], { type: 'application/octet-stream' });
      
      // 4. Send Ciphertext to standard vault storage
      const formData = new FormData();
      formData.append('vault_id', selectedVault);
      formData.append('file', new File([encryptedBlob], rawFile.name, { type: 'application/pdf' }));

      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      alert('Document imported and encrypted successfully!');
      navigate(`/vault/${selectedVault}`);
    } catch (err) {
      console.error(err);
      alert('Import failed');
    } finally {
      setImportingUri(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-gray-700 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <DownloadCloud className="w-6 h-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-white">Import from DigiLocker</h1>
      </div>

      <div className="card p-6 border-blue-500/20 bg-blue-900/5">
        <div className="flex gap-3 mb-4">
          <ShieldAlert className="w-6 h-6 text-green-400 shrink-0" />
          <p className="text-sm text-gray-300 leading-relaxed">
            Documents imported from DigiLocker arrive as plaintext locally in your browser proxy 
            and are immediately encrypted using your <strong className="text-white">AES-256 Vault Key</strong> before 
            being stored on the cloud. The master server never sees the underlying document.
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Select Target Vault</label>
          <select 
            value={selectedVault} 
            onChange={(e) => setSelectedVault(e.target.value)}
            className="input-field max-w-sm"
          >
            <option value="" disabled>-- Choose an unlocked vault --</option>
            {vaults.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} {vaultKey?.[v.id] ? '(Unlocked)' : '(Locked)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-400 font-mono">Fetching issued documents...</div>
      ) : docs.length === 0 ? (
        <div className="text-center p-12 text-gray-500 card border-dashed border-2">
          No documents found in your DigiLocker account.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc, idx) => (
            <div key={idx} className="card p-5 hover:border-gray-600 transition flex flex-col justify-between">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-gray-800 rounded-lg text-blue-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-200 line-clamp-2">{doc.name || "Government Document"}</h3>
                  <p className="text-xs text-gray-500 mt-1">{doc.issuer || "Digital Locker System"}</p>
                  <p className="text-[10px] text-gray-600 mt-1 truncate" title={doc.uri}>{doc.uri}</p>
                </div>
              </div>
              <button 
                onClick={() => handleImport(doc)}
                disabled={importingUri === doc.uri || !selectedVault}
                className="w-full btn-secondary py-2 flex items-center justify-center gap-2"
              >
                {importingUri === doc.uri ? (
                  <><Loader2 className="w-4 h-4 animate-spin"/> Importing...</>
                ) : (
                  <><DownloadCloud className="w-4 h-4"/> Cryptographic Import</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
