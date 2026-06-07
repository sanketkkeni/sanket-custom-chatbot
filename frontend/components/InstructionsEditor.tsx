import { useState } from 'react';
import { Save, Loader2, Edit3 } from 'lucide-react';

interface InstructionsEditorProps {
  initialInstructions?: string;
  onSave: (instructions: string) => Promise<void>;
}

export default function InstructionsEditor({ initialInstructions = '', onSave }: InstructionsEditorProps) {
  const [instructions, setInstructions] = useState(initialInstructions);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(instructions);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-dark rounded-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm"
      >
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-primary-400" />
          <span>Agent Instructions</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded-lg text-sm focus:border-primary-500 transition-colors min-h-[100px]"
            placeholder="Enter custom instructions for the agent..."
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Instructions
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronDown(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
