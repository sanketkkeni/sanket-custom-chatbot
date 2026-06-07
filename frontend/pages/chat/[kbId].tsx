import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Brain, Send, Loader2, ArrowLeft, User, Bot, ExternalLink, Plus } from 'lucide-react';
import Link from 'next/link';
import { sendChat, getKB } from '../../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { uri: string; content: string }[];
}

export default function ChatPage() {
  const router = useRouter();
  const { kbId } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [kb, setKB] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (kbId && user) {
      getKB(kbId as string)
        .then(setKB)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [kbId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setSending(true);

    try {
      const result = await sendChat(kbId as string, userMessage, '', conversationId);
      setConversationId(result.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.response,
          sources: result.sources,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-dark-900"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Brain className="h-6 w-6 text-primary-500" />
            <div>
              <h1 className="font-semibold">{kb?.name || 'Chat'}</h1>
              <p className="text-xs text-gray-400">Chat with your knowledge base</p>
            </div>
          </div>
          {conversationId && (
            <Link
              href={`/history`}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" /> View History
            </Link>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <Brain className="h-16 w-16 text-dark-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Start a Conversation</h2>
              <p className="text-gray-400">Ask a question about your documents.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} message-enter`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary-600' : 'bg-dark-600'}`}>
                {msg.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5 text-primary-400" />}
              </div>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-primary-600/20 border border-primary-500/30' : 'bg-dark-700 border border-dark-500'} rounded-2xl p-4`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-dark-500">
                    <p className="text-xs text-gray-500 mb-2">Sources:</p>
                    {msg.sources.map((s, j) => (
                      <div key={j} className="text-xs text-gray-400 mb-1 flex items-start gap-1">
                        <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="truncate">{s.uri?.split('/').pop() || s.uri}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary-400" />
              </div>
              <div className="bg-dark-700 border border-dark-500 rounded-2xl p-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="bg-dark-800 border-t border-dark-600 p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1 px-4 py-3 bg-dark-700 border border-dark-500 rounded-xl focus:border-primary-500 transition-colors"
            placeholder="Ask a question about your documents..."
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-xl transition-colors"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </footer>
    </div>
  );
}
