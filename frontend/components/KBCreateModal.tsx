import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { createKB } from '../lib/api';

interface KBCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function KBCreateModal({ open, onClose, onCreated }: KBCreateModalProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createKB(name.trim());
      setName('');
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Create Knowledge Base</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">{error}</div>}

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors mb-6"
          placeholder="Enter KB name"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 border border-dark-500 rounded-lg hover:border-gray-500 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {creating && <Loader2 className="h-5 w-5 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
