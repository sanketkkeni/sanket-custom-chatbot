import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { Brain, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { resendVerificationCode } from '../lib/auth';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      const errorMessage = err?.message || String(err) || 'Invalid email or password';
      const lowerError = errorMessage.toLowerCase();
      if (lowerError.includes('not confirmed') || lowerError.includes('not verified')) {
        setError(
          <>
            Your account is not verified. Please check your email.{' '}
            <button
              onClick={async () => {
                try { await resendVerificationCode(email); } catch (e) { }
                router.push(`/confirm?email=${encodeURIComponent(email)}`);
              }}
              className="text-primary-400 hover:text-primary-300 underline"
            >
              Verify now
            </button>
          </>
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white flex flex-col">
      <header className="p-6">
        <nav className="flex justify-between items-center max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary-500" />
            <span className="text-xl font-bold">Custom Chatbot</span>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="glass-dark p-8 rounded-2xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
              <p className="text-gray-400">Sign in to your account</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors" placeholder="you@example.com" required />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors" placeholder="Enter your password" required />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                Sign In
              </button>
            </form>

            <div className="mt-6 text-center text-gray-400 text-sm">
              Don't have an account?{' '}
              <Link href="/signup" className="text-primary-400 hover:text-primary-300 font-medium">Sign up</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
