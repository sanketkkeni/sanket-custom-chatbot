import { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { getUploadUrl, uploadToS3 } from '../lib/api';

interface FileUploadProps {
  kbId: string;
  onUploadComplete: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/html',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export default function FileUpload({ kbId, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError('');

    if (file.size > MAX_FILE_SIZE) {
      setError('File is too large. Maximum size is 50MB.');
      return;
    }

    setUploading(true);
    try {
      const { presignedUrl } = await getUploadUrl(kbId, file.name, file.type);
      await uploadToS3(presignedUrl, file);
      onUploadComplete();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-dark-500 rounded-xl p-8 cursor-pointer hover:border-primary-500 transition-colors">
        <Upload className="h-10 w-10 text-gray-400 mb-4" />
        <span className="text-gray-400 mb-2">{uploading ? 'Uploading...' : 'Click to upload or drag and drop'}</span>
        <span className="text-xs text-gray-500">PDF, TXT, MD, HTML, DOCX, CSV, XLSX (max 50MB)</span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
      </label>
      {error && (
        <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}
    </div>
  );
}
