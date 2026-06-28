import { useRouter } from 'next/router';
import { Brain, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-dark-900 text-white flex">
      <div className="w-64 bg-dark-800 border-r border-dark-600 p-6 flex flex-col">
        <Link href="/dashboard" className="flex items-center gap-2 mb-8">
          <Brain className="h-8 w-8 text-primary-500" />
          <span className="text-lg font-bold">Custom Chatbot</span>
        </Link>

        <nav className="flex-1 space-y-2">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              router.pathname === '/dashboard' ? 'bg-dark-600 text-primary-400' : 'text-gray-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>
        </nav>

        <div className="border-t border-dark-600 pt-4">
          <div className="text-sm text-gray-400 mb-2">{user?.email}</div>
          <button onClick={() => { signOut(); router.push('/'); }} className="text-sm text-red-400 hover:text-red-300">
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
