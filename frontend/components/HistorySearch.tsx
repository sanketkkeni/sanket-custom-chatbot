import { useState } from 'react';
import { Search, Loader2, Clock, Trash2 } from 'lucide-react';

interface HistorySearchProps {
  conversations: any[];
  loading: boolean;
  onSearch: (query: string) => void;
  onSelect: (conv: any) => void;
  onDelete: (conversationId: string) => void;
  selectedId?: string;
  deleting?: string | null;
}

export default function HistorySearch({
  conversations,
  loading,
  onSearch,
  onSelect,
  onDelete,
  selectedId,
  deleting,
}: HistorySearchProps) {
  const [query, setQuery] = useState('');

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors text-sm"
          placeholder="Search conversations by title..."
        />
      </div>

      <div className="space-y-1">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary-500" /></div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {query ? 'No matching conversations' : 'No conversations yet'}
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.conversationId}
              onClick={() => onSelect(conv)}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                selectedId === conv.conversationId ? 'bg-dark-600' : 'hover:bg-dark-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{conv.title}</p>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(conv.createdAt).toLocaleDateString()} &bull; {conv.messageCount || 0} messages
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv.conversationId); }}
                className="text-gray-500 hover:text-red-400 ml-2"
              >
                {deleting === conv.conversationId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
