import { useState, useEffect } from 'react';
import { Bot, ChevronDown, Loader2 } from 'lucide-react';

interface Agent {
  agentId: string;
  name: string;
  instructions?: string;
}

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgentId: string;
  onSelect: (agentId: string) => void;
}

export default function AgentSelector({ agents, selectedAgentId, onSelect }: AgentSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedAgent = agents.find((a) => a.agentId === selectedAgentId);

  if (agents.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-dark-700 border border-dark-500 rounded-lg text-sm hover:border-primary-500 transition-colors"
      >
        <Bot className="h-4 w-4 text-primary-400" />
        <span>{selectedAgent?.name || 'Select Agent'}</span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-dark-700 border border-dark-500 rounded-xl shadow-xl z-50">
          {agents.map((agent) => (
            <button
              key={agent.agentId}
              onClick={() => { onSelect(agent.agentId); setOpen(false); }}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-dark-600 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                agent.agentId === selectedAgentId ? 'bg-dark-600 text-primary-400' : ''
              }`}
            >
              <div className="font-medium">{agent.name}</div>
              {agent.instructions && (
                <div className="text-xs text-gray-500 truncate mt-1">{agent.instructions}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
