import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Brain, Search, Trash2, MessageSquare, Clock, ArrowLeft, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { listConversations, getConversation, deleteConversation } from '../lib/api';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function History() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [selectedContent, setSelectedContent] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const loadConversations = async () => {
    try {
      const data = await listConversations(search || undefined);
      setConversations(data.conversations || []);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => loadConversations(), 300);
      return () => clearTimeout(timer);
    }
  }, [search]);

  const handleSelect = async (conv: any) => {
    try {
      const data = await getConversation(conv.conversationId);
      setSelectedConv(conv);
      setSelectedContent(data.content || '');
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
    }
  };

  const handleDelete = async (conversationId: string) => {
    if (!confirm('Delete this conversation?')) return;
    setDeleting(conversationId);
    try {
      await deleteConversation(conversationId);
      if (selectedConv?.conversationId === conversationId) {
        setSelectedConv(null);
        setSelectedContent('');
      }
      loadConversations();
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
      {/* Sidebar */}
      <div className="w-80 bg-dark-800 border-r border-dark-600 flex flex-col">
        <div className="p-4 border-b border-dark-600">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="h-5 w-5" /> Dashboard
          </Link>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors text-sm"
              placeholder="Search conversations..."
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary-500" /></div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.conversationId}
                onClick={() => handleSelect(conv)}
                className={`p-4 border-b border-dark-600 cursor-pointer hover:bg-dark-700 transition-colors ${
                  selectedConv?.conversationId === conv.conversationId ? 'bg-dark-600' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(conv.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">{conv.messageCount || 0} messages</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(conv.conversationId); }}
                    className="text-gray-500 hover:text-red-400 ml-2"
                  >
                    {deleting === conv.conversationId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {selectedConv ? (
          <div>
            <h1 className="text-2xl font-bold mb-2">{selectedConv.title}</h1>
            <p className="text-sm text-gray-400 mb-6">
              {new Date(selectedConv.createdAt).toLocaleString()} &bull; {selectedConv.messageCount} messages
            </p>
            <div className="glass-dark rounded-2xl p-6">
              <MarkdownRenderer content={selectedContent} />
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <Brain className="h-16 w-16 text-dark-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Select a Conversation</h2>
            <p className="text-gray-400">Choose a conversation from the sidebar to view its content.</p>
          </div>
        )}
      </div>
    </div>
  );
}
