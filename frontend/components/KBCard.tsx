import { Brain, FileText, RefreshCw, MessageSquare, Trash2 } from 'lucide-react';
import { useRouter } from 'next/router';

interface KBCardProps {
  kb: {
    kbId: string;
    name: string;
    status: string;
    documentCount?: number;
  };
  onDelete: (kbId: string) => void;
  deleting?: boolean;
}

export default function KBCard({ kb, onDelete, deleting }: KBCardProps) {
  const router = useRouter();

  return (
    <div className="glass-dark rounded-2xl p-6 hover:border-primary-500/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold">{kb.name}</h3>
            <span className={`text-xs ${kb.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}`}>
              {kb.status}
            </span>
          </div>
        </div>
        {deleting ? (
          <RefreshCw className="h-5 w-5 animate-spin text-red-400" />
        ) : (
          <button onClick={() => onDelete(kb.kbId)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
        <span className="flex items-center gap-1"><FileText className="h-4 w-4" />{kb.documentCount || 0} docs</span>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => router.push(`/kb/${kb.kbId}`)}
          className="flex-1 px-3 py-2 bg-dark-600 hover:bg-dark-500 rounded-lg text-sm transition-colors"
        >
          Manage
        </button>
        <button
          onClick={() => router.push(`/chat/${kb.kbId}`)}
          className="flex-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
        >
          <MessageSquare className="h-4 w-4" /> Chat
        </button>
      </div>
    </div>
  );
}
