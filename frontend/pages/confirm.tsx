import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Brain, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { confirmSignUp } from '../lib/auth';

export default function Confirm() {
  const router = useRouter();
  const email = (router.query.email as string) || '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (!email) router.push('/signup');
  }, [router.isReady, email, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!code || code.length < 6) { setError('Please enter a valid verification code'); return; }
    setLoading(true);
    try {
      await confirmSignUp(email, code);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
            <div className="glass-dark p-8 rounded-2xl text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="h-10 w-10 text-green-400" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Email Verified!</h1>
              <p className="text-gray-400 mb-8">Your account has been successfully verified.<br />You can now sign in.</p>
              <button onClick={() => router.push('/login')} className="w-full py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition-colors">
                Sign In
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
              <h1 className="text-3xl font-bold mb-2">Enter Verification Code</h1>
              <p className="text-gray-400">We sent a code to<br /><span className="text-white font-medium">{email || 'loading...'}</span></p>
              <p className="text-gray-500 text-sm mt-3">Don't forget to check your spam folder!</p>
            </div>
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />{error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">Verification Code</label>
                <input id="code" type="text" value={code} onChange={(e) => setCode(e.target.value)} className="w-full px-4 py-3 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors text-center text-2xl tracking-widest font-mono" placeholder="000000" maxLength={10} required />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                Verify Account
              </button>
            </form>
            <div className="mt-6 text-center text-gray-400 text-sm">
              <button onClick={() => router.push('/signup')} className="text-primary-400 hover:text-primary-300">Request new code</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
