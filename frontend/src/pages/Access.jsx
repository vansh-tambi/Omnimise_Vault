import { Link2, FileText, ShieldCheck } from 'lucide-react';

export default function Access() {
  const [access, setAccess] = useState([]);
  const [receivedShares, setReceivedShares] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, recRes] = await Promise.all([
          api.get('/access/list?vault_id=all'),
          api.get('/access/received')
        ]);
        setAccess(accRes.data);
        setReceivedShares(recRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-700 pb-4">
          <ShieldCheck className="w-6 h-6 text-gray-300" />
          <h1 className="text-2xl font-semibold text-white">Permissions Managed by You</h1>
        </div>

        {loading ? (
          <div className="text-gray-400">Loading access rights...</div>
        ) : access.length === 0 ? (
          <div className="card text-center p-12 text-gray-400 border-dashed border-2">
              You haven't granted access to any of your vaults yet.
          </div>
        ) : (
          <div className="grid gap-4 max-w-2xl">
            {access.map(acc => (
              <div key={acc.id} className="card p-4 flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">Vault ID: {acc.vault_id.slice(-8)}...</p>
                  <p className="text-sm text-gray-400">Recipient ID: {acc.shared_with.slice(-8)}...</p>
                </div>
                <span className="text-blue-400 font-bold uppercase tracking-widest text-xs px-2 py-1 bg-blue-500/10 rounded">
                  {acc.permission}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6 pt-6 border-t border-gray-800">
        <div className="flex items-center gap-3">
           <Link2 className="w-6 h-6 text-blue-400" />
           <h2 className="text-xl font-semibold text-white">Shared with Me</h2>
        </div>
        
        {loading ? (
           <div className="text-gray-400">Syncing shared documents...</div>
        ) : receivedShares.length === 0 ? (
           <div className="card text-center p-12 text-gray-400 border-dashed border-2">
              No one has shared any documents with you yet.
           </div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
             {receivedShares.map(share => (
               <div key={share.access_id} className="card p-5 group hover:border-blue-500/50 transition cursor-pointer flex items-center justify-between" onClick={() => window.location.href=`/vault/${share.document_id}?shared=true`}>
                 <div className="flex items-center gap-4 truncate">
                   <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500/20 transition">
                     <FileText className="w-6 h-6" />
                   </div>
                   <div className="truncate">
                     <h4 className="text-white font-medium truncate">{share.filename}</h4>
                     <p className="text-xs text-gray-400">Owner: {share.owner_id.slice(-8)}</p>
                   </div>
                 </div>
                 <div className="text-xs text-gray-500 flex flex-col items-end">
                    <span>{new Date(share.granted_at).toLocaleDateString()}</span>
                    {share.expires_at && <span className="text-red-400/60">Expires soon</span>}
                 </div>
               </div>
             ))}
           </div>
        )}
      </div>
    </div>
  );
}
