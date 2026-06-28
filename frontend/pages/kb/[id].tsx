import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Brain, ArrowLeft, Loader2, Upload, FileText, FileSpreadsheet, Trash2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getKB, listFiles, deleteFile, startSync, getSyncStatus, getKBStats, getUploadUrls, uploadToS3 } from '../../lib/api';

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

  const triggerSync = async () => {
    if (!id || syncing) return;
    setSyncing(true);
    setSyncStatus(null);
    setError('');
    try {
      const result = await startSync(id as string);
      setSyncStatus(result);
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !id) return;
    const selectedFiles = Array.from(fileList);
    setUploading(true);
    setError('');
    try {
      const filesPayload = selectedFiles.map(f => ({ filename: f.name, contentType: f.type }));
      const { presignedUrls } = await getUploadUrls(id as string, filesPayload);
      await Promise.all(
        presignedUrls.map((item: { filename: string; presignedUrl: string }) =>
          uploadToS3(item.presignedUrl, selectedFiles.find(f => f.name === item.filename)!)
        )
      );
      loadKB();
      triggerSync();
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
      triggerSync();
    } catch (err: any) {
      setError(err.message);
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

        <div className="mb-8">
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
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="glass-dark p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-primary-400">{stats.totalFiles}</div>
              <div className="text-sm text-gray-400">Total Files</div>
            </div>
            <div className="glass-dark p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-accent-400">{stats.indexedCount ?? 0}</div>
              <div className="text-sm text-gray-400">Indexed Documents</div>
            </div>
            <div className="glass-dark p-4 rounded-xl text-center">
              <div className={`text-2xl font-bold ${(stats.failedCount ?? 0) > 0 ? 'text-red-400' : 'text-gray-400'}`}>{stats.failedCount ?? 0}</div>
              <div className="text-sm text-gray-400">Failed Documents</div>
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
            <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-6">
              {files.map((file: any) => {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);

                const getFileConfig = (e: string) => {
                  const config: Record<string, { icon: any; color: string }> = {
                    pdf: { icon: FileText, color: 'text-red-400' },
                    txt: { icon: FileText, color: 'text-blue-400' },
                    md: { icon: FileText, color: 'text-blue-400' },
                    html: { icon: FileText, color: 'text-orange-400' },
                    htm: { icon: FileText, color: 'text-orange-400' },
                    csv: { icon: FileSpreadsheet, color: 'text-green-400' },
                    doc: { icon: FileText, color: 'text-indigo-400' },
                    docx: { icon: FileText, color: 'text-indigo-400' },
                    xls: { icon: FileSpreadsheet, color: 'text-green-500' },
                    xlsx: { icon: FileSpreadsheet, color: 'text-green-500' },
                  };
                  return config[e] || { icon: FileText, color: 'text-gray-400' };
                };

                const { icon: Icon, color } = getFileConfig(ext);

                return (
                  <div key={file.key} className="group relative glass-dark rounded-xl overflow-hidden hover:bg-dark-700 transition-colors">
                    <a href={file.presignedUrl} target="_blank" rel="noopener noreferrer" className="block p-4">
                      {isImage ? (
                        <div className="aspect-square bg-dark-800 rounded-lg overflow-hidden mb-2">
                          <img src={file.presignedUrl} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-24 mb-2">
                          <Icon className={`h-12 w-12 ${color}`} />
                          <span className="text-xs font-medium text-gray-500 mt-1 uppercase">.{ext}</span>
                        </div>
                      )}
                      <div className="text-sm truncate" title={file.name}>{file.name}</div>
                      <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)}KB</div>
                    </a>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteFile(file.key.split('/').pop()); }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-800/80 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
