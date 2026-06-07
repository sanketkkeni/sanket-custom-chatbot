import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Brain, ArrowLeft, Loader2, Upload, FileText, Trash2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getKB, listFiles, deleteFile, startSync, getSyncStatus, getKBStats, getUploadUrl, uploadToS3 } from '../../lib/api';

export default function KBDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [kb, setKB] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const loadKB = async () => {
    if (!id) return;
    try {
      const [kbData, filesData, statsData] = await Promise.all([
        getKB(id as string),
        listFiles(id as string),
        getKBStats(id as string),
      ]);
      setKB(kbData);
      setFiles(filesData.files || []);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && user) loadKB();
  }, [id, user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    setError('');
    try {
      const { presignedUrl } = await getUploadUrl(id as string, file.name, file.type);
      await uploadToS3(presignedUrl, file);
      loadKB();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileKey: string) => {
    if (!id) return;
    try {
      await deleteFile(id as string, fileKey);
      loadKB();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSync = async () => {
    if (!id) return;
    setSyncing(true);
    setError('');
    try {
      const result = await startSync(id as string);
      setSyncStatus(result);
      // Poll for status
      const poll = setInterval(async () => {
        try {
          const status = await getSyncStatus(id as string);
          setSyncStatus(status);
          if (status.status === 'COMPLETE' || status.status === 'FAILED') {
            clearInterval(poll);
            setSyncing(false);
            loadKB();
          }
        } catch { }
      }, 5000);
    } catch (err: any) {
      setError(err.message);
      setSyncing(false);
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-dark-900"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>;
  }

  if (loading) {
    return <div className="min-h-screen bg-dark-900 text-white p-8"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>;
  }

  if (!kb) {
    return <div className="min-h-screen bg-dark-900 text-white p-8">KB not found</div>;
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="h-5 w-5" /> Back to Dashboard
        </Link>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{kb.name}</h1>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>Status: <span className={kb.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}>{kb.status}</span></span>
              {syncing && <span className="text-yellow-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Syncing...</span>}
              {!syncing && kb.lastSyncStatus === 'COMPLETE' && (
                <span>Last sync: <span className="text-green-400">Completed</span></span>
              )}
              {!syncing && kb.lastSyncStatus === 'FAILED' && (
                <span>Last sync: <span className="text-red-400">Failed</span></span>
              )}
              {!syncing && kb.lastSyncStatus === 'IN_PROGRESS' && (
                <span className="text-yellow-400">Sync in progress...</span>
              )}
              <span>Files: {kb.documentCount || 0}</span>
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg transition-colors"
          >
            {syncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {error && <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">{error}</div>}

        {(syncing || syncStatus) && syncStatus?.status !== 'COMPLETE' && (
          <div className="mb-6 glass-dark p-4 rounded-xl">
            <div className={`flex items-center gap-2 mb-2 ${
              syncStatus?.status === 'FAILED' ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {syncStatus?.status === 'FAILED' ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              <span>Sync Status: {syncStatus?.status || 'STARTING'}</span>
            </div>
            {syncStatus?.statistics && (
              <div className="text-sm text-gray-400">
                Scanned: {syncStatus.statistics.numberofDocumentsScanned} | Indexed: {syncStatus.statistics.numberofNewDocumentsIndexed}
                {syncStatus.statistics.numberofDocumentsFailed > 0 && (
                  <> | <span className="text-red-400">Failed: {syncStatus.statistics.numberofDocumentsFailed}</span></>
                )}
              </div>
            )}
            {syncStatus?.error && (
              <div className="mt-2 text-sm text-red-400/80 break-words">Error: {syncStatus.error}</div>
            )}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="glass-dark p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-primary-400">{stats.totalFiles}</div>
              <div className="text-sm text-gray-400">Total Files</div>
            </div>
            <div className="glass-dark p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-accent-400">{stats.indexedCount ?? 0}</div>
              <div className="text-sm text-gray-400">Indexed Documents</div>
            </div>
            <div className="glass-dark p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-purple-400">{(stats.totalSizeBytes / 1024 / 1024).toFixed(1)}MB</div>
              <div className="text-sm text-gray-400">Total Size</div>
            </div>
          </div>
        )}

        {/* Upload */}
        <div className="glass-dark p-6 rounded-2xl mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Upload className="h-5 w-5 text-primary-400" /> Upload Documents</h2>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-dark-500 rounded-xl p-8 cursor-pointer hover:border-primary-500 transition-colors">
            <Upload className="h-10 w-10 text-gray-400 mb-4" />
            <span className="text-gray-400 mb-2">{uploading ? 'Uploading...' : 'Click to upload or drag and drop'}</span>
            <span className="text-xs text-gray-500">PDF, TXT, MD, HTML, DOCX, CSV, XLSX (max 50MB)</span>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {/* Files */}
        <div className="glass-dark rounded-2xl">
          <div className="p-6 border-b border-dark-600">
            <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-primary-400" /> Files ({files.length})</h2>
          </div>
          {files.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No files uploaded yet</div>
          ) : (
            <div className="divide-y divide-dark-600">
              {files.map((file: any) => (
                <div key={file.key} className="flex items-center justify-between p-4 hover:bg-dark-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="text-sm">{file.name}</div>
                      <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)}KB</div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteFile(file.key.split('/').pop())} className="text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
