import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Brain, Plus, Loader2, Trash2, MessageSquare, FileText, RefreshCw, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { listKBs, deleteKB, createKB } from '../lib/api';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { sidebarOpen, setSidebarOpen, refreshKBs } = useApp();
  const [kbs, setKBs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const loadKBs = async () => {
    try {
      const data = await listKBs();
      setKBs(data.kbs || []);
    } catch (err: any) {
      console.error('Failed to load KBs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      loadKBs();
    }
  }, [user, refreshKBs]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createKB(newName.trim());
      setNewName('');
      setShowCreate(false);
      loadKBs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (kbId: string) => {
    if (!confirm('Delete this knowledge base? This action cannot be undone.')) return;
    setDeleting(kbId);
    try {
      await deleteKB(kbId);
      loadKBs();
    } catch (err: any) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(null);
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-dark-900"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 bg-dark-800 border-r border-dark-600 p-6 flex flex-col flex-shrink-0
        ${sidebarOpen ? 'max-md:flex' : 'max-md:hidden'}
        md:flex
        max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50
      `}>
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary-500" />
            <span className="text-lg font-bold">Custom Chatbot</span>
          </Link>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 bg-dark-600 rounded-lg text-primary-400">
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </div>
          <Link href="/history" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-600 transition-colors">
            <Clock className="h-5 w-5" />
            <span>History</span>
          </Link>
        </nav>

        <div className="border-t border-dark-600 pt-4">
          <div className="text-sm text-gray-400 mb-2">{user.email}</div>
          <button onClick={() => { signOut(); router.push('/'); }} className="text-sm text-red-400 hover:text-red-300">Sign Out</button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 p-4 md:p-8 min-w-0">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold">Knowledge Bases</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors text-sm md:text-base whitespace-nowrap">
            <Plus className="h-5 w-5" />
            New KB
          </button>
        </div>

        {error && <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">{error}</div>}

        {showCreate && (
          <div className="mb-8 glass-dark p-6 rounded-2xl">
            <h2 className="text-lg font-semibold mb-4">Create New Knowledge Base</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-4 py-3 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors"
                placeholder="Enter KB name"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <button onClick={handleCreate} disabled={creating || !newName.trim()} className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg font-semibold transition-colors">
                {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-3 border border-dark-500 rounded-lg hover:border-gray-500 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>
        ) : kbs.length === 0 ? (
          <div className="text-center py-20">
            <Brain className="h-16 w-16 text-dark-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Knowledge Bases Yet</h2>
            <p className="text-gray-400 mb-6">Create your first KB to start chatting with your documents.</p>
            <button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
              Create Your First KB
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kbs.map((kb: any) => (
              <div key={kb.kbId} className="glass-dark rounded-2xl p-6 hover:border-primary-500/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-lg">{kb.name}</h3>
                  {deleting === kb.kbId ? (
                    <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                  ) : (
                    <button onClick={() => handleDelete(kb.kbId)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                  <span className="flex items-center gap-1"><FileText className="h-4 w-4" />{kb.documentCount || 0} docs</span>
                  <span className={`flex items-center gap-1 ${kb.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}`}>
                    <RefreshCw className="h-4 w-4" />{kb.status}
                  </span>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LayoutDashboard(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>; }
function Clock(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
