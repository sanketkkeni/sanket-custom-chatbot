import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface SyncStatusProps {
  status: any;
  syncing: boolean;
  onSync: () => void;
}

export default function SyncStatus({ status, syncing, onSync }: SyncStatusProps) {
  if (!status) {
    return (
      <button onClick={onSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg transition-colors">
        <RefreshCw className="h-5 w-5" /> Sync Now
      </button>
    );
  }

  const isRunning = status.status === 'IN_PROGRESS' || status.status === 'STARTED';
  const isComplete = status.status === 'COMPLETE';
  const isFailed = status.status === 'FAILED';

  return (
    <div className="glass-dark p-4 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />}
          {isComplete && <CheckCircle className="h-5 w-5 text-green-400" />}
          {isFailed && <AlertCircle className="h-5 w-5 text-red-400" />}
          <span className={`font-medium ${
            isRunning ? 'text-yellow-400' : isComplete ? 'text-green-400' : isFailed ? 'text-red-400' : 'text-gray-400'
          }`}>
            {status.status}
          </span>
        </div>
        {!isRunning && (
          <button onClick={onSync} className="text-sm text-primary-400 hover:text-primary-300">
            Sync Again
          </button>
        )}
      </div>

      {status.error && (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
          {status.error}
        </div>
      )}

      {status.statistics && (
        <div className="mt-2 text-sm text-gray-400">
          <div className="flex gap-4 flex-wrap">
            <span>Scanned: {status.statistics.numberofDocumentsScanned}</span>
            <span>New: {status.statistics.numberofNewDocumentsIndexed}</span>
            <span>Modified: {status.statistics.numberofModifiedDocumentsIndexed}</span>
            {status.statistics.numberofDocumentsFailed > 0 && (
              <span className="text-red-400">Failed: {status.statistics.numberofDocumentsFailed}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
