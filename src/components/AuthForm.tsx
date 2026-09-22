'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-9 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="1.9">
              <path d="M5 9v6M5 11l11-5v12L5 13M16 8.5a3.5 3.5 0 0 1 0 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="leading-tight">
            <div className="font-display text-xl font-semibold tracking-tight text-ink">Ɔbɔfo</div>
            <div className="text-sm text-ink/45">WhatsApp alerts to your inbox</div>
          </div>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1.5 text-sm text-ink/55">
          {isSignup
            ? 'Choose who you want to hear from, and where alerts should land.'
            : 'Sign in to manage your watched contacts and alerts.'}
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          {isSignup && (
            <Field label="Name (optional)">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ama Owusu"
                autoComplete="name"
              />
            </Field>
          )}

          <Field label="Email">
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          <Field label="Password">
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? 'At least 6 characters' : '••••••••'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-clay-600/20 bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-ink/55">
          {isSignup ? (
            <>
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-800">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
