import { UploadCloud } from 'lucide-react';

export default function UploadButton({ onUpload }) {
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="relative inline-block">
      <input 
        type="file" 
        onChange={handleFileChange} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        title="Upload Document"
      />
      <button className="btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20">
        <UploadCloud className="w-5 h-5" />
        <span>Upload Document</span>
      </button>
    </div>
  );
}
