import { FileText, Trash2, Loader2 } from 'lucide-react';

interface FileListProps {
  files: { key: string; name: string; size: number; lastModified: string }[];
  onDelete: (fileKey: string) => void;
  deleting?: string | null;
}

export default function FileList({ files, onDelete, deleting }: FileListProps) {
  if (files.length === 0) {
    return <div className="text-center py-8 text-gray-500">No files uploaded yet</div>;
  }

  return (
    <div className="divide-y divide-dark-600">
      {files.map((file) => (
        <div key={file.key} className="flex items-center justify-between p-4 hover:bg-dark-700 transition-colors">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-400" />
            <div>
              <div className="text-sm">{file.name}</div>
              <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)}KB</div>
            </div>
          </div>
          <button
            onClick={() => onDelete(file.key.split('/').pop() || file.key)}
            disabled={deleting === file.key}
            className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {deleting === file.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      ))}
    </div>
  );
}
