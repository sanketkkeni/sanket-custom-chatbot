import { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { getUploadUrls, uploadToS3 } from '../lib/api';

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
const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'md', 'html', 'htm', 'csv', 'doc', 'docx', 'xls', 'xlsx'];
const ACCEPT_STRING = '.pdf,.txt,.md,.html,.htm,.csv,.doc,.docx,.xls,.xlsx';

export default function FileUpload({ kbId, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    setErrors([]);
    setSuccessCount(0);

    const validFiles = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const isAllowedType = ALLOWED_TYPES.includes(f.type);
      const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);
      if (f.size > MAX_FILE_SIZE) {
        setErrors(prev => [...prev, `${f.name}: File is too large (max 50MB)`]);
        return false;
      }
      if (!isAllowedType && !isAllowedExt) {
        setErrors(prev => [...prev, `${f.name}: ${ext.toUpperCase()} files are not supported. Allowed: PDF, TXT, MD, HTML, CSV, DOC, DOCX, XLS, XLSX`]);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      const filesPayload = validFiles.map(f => ({ filename: f.name, contentType: f.type }));
      const { presignedUrls } = await getUploadUrls(kbId, filesPayload);

      const results = await Promise.allSettled(
        presignedUrls.map((item: { filename: string; presignedUrl: string }) =>
          uploadToS3(item.presignedUrl, validFiles.find(f => f.name === item.filename)!)
        )
      );

      let success = 0;
      const errs: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') success++;
        else errs.push(`${validFiles[i].name}: ${r.reason?.message || 'Upload failed'}`);
      });

      setSuccessCount(success);
      if (errs.length > 0) setErrors(errs);
      if (success > 0) onUploadComplete();
    } catch (err: any) {
      setErrors([err.message || 'Upload failed']);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-dark-500 rounded-xl p-8 cursor-pointer hover:border-primary-500 transition-colors">
        <Upload className="h-10 w-10 text-gray-400 mb-4" />
        <span className="text-gray-400 mb-2">
          {uploading ? `Uploading ${successCount} file${successCount !== 1 ? 's' : ''}...` : 'Click to upload or drag and drop'}
        </span>
        <span className="text-xs text-gray-500">PDF, TXT, MD, HTML, DOCX, CSV, XLSX (max 50MB each)</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ACCEPT_STRING}
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          }}
        />
      </label>
      {successCount > 0 && (
        <div className="mt-3 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />{successCount} file{successCount !== 1 ? 's' : ''} uploaded successfully
        </div>
      )}
      {errors.length > 0 && (
        <div className="mt-3 space-y-2">
          {errors.map((err, i) => (
            <div key={i} className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />{err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
