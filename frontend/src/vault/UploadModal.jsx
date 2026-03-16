import { useState } from 'react';
import { CloudUpload, X, Clock, Eye } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="card w-full max-w-md bg-gray-900 border-blue-500/30 p-6 rounded-xl shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <CloudUpload className="w-6 h-6 text-blue-400" />
          Secure Upload
        </h3>

        <div className="space-y-6">
          <div className="group relative border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-blue-500/50 transition bg-gray-800/30">
            <input
              type="file"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {file ? (
              <div className="text-blue-400">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="text-gray-500">
                <p>Click or drag to select file</p>
                <p className="text-xs mt-1">Max size 50MB</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wider">Optional Security Settings</p>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                    <Eye className="w-4 h-4 text-blue-400" />
                    Self-destruct after N views
                  </label>
                  <input
                    type="number"
                    value={selfDestructViews}
                    onChange={(e) => setSelfDestructViews(e.target.value)}
                    className="input-field w-full"
                    placeholder="e.g. 1"
                    min="1"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    Auto-delete after date
                  </label>
                  <input
                    type="datetime-local"
                    value={selfDestructAt}
                    onChange={(e) => setSelfDestructAt(e.target.value)}
                    className="input-field w-full text-gray-300"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Cancel
          </button>
          <button
            disabled={!file || loading}
            onClick={handleConfirm}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Encrypt & Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
