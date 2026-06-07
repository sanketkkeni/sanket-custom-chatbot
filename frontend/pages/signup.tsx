import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { Brain, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function Signup() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await signUp(email, password);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
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
                <CheckCircle className="h-10 w-10 text-green-400" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Check Your Email</h1>
              <p className="text-gray-400 mb-2">We&apos;ve sent a verification code to<br /><span className="text-white font-medium">{email}</span></p>
              <p className="text-gray-500 text-sm mb-6">Check your inbox and spam folder for the code.</p>
              <button onClick={() => router.push(`/confirm?email=${encodeURIComponent(email)}`)} className="w-full py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition-colors">
                Enter Verification Code
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
              <h1 className="text-3xl font-bold mb-2">Create Account</h1>
              <p className="text-gray-400">Start building your custom chatbots</p>
            </div>
            {error && <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors" placeholder="you@example.com" required />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors" placeholder="At least 8 characters" required />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 bg-dark-700 border border-dark-500 rounded-lg focus:border-primary-500 transition-colors" placeholder="Confirm your password" required />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                Create Account
              </button>
            </form>
            <div className="mt-6 text-center text-gray-400 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
