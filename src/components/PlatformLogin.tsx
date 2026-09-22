'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlatformLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/platform/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Could not sign in.');
      return;
    }
    router.push('/platform');
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(650px circle at 20% 10%, rgba(18,136,95,0.28), transparent 55%), radial-gradient(700px circle at 85% 90%, rgba(233,162,59,0.12), transparent 50%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="font-display text-2xl font-semibold tracking-tight">Ɔbɔfo</span>
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white/70 ring-1 ring-inset ring-white/15">
            Platform
          </span>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-1.5 text-sm text-white/50">Restricted access. Administrator accounts only.</p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white/70">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@obofo.app"
              autoComplete="email"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-white outline-none transition placeholder:text-white/30 focus:border-pine-500 focus:ring-4 focus:ring-pine-500/20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white/70">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-white outline-none transition placeholder:text-white/30 focus:border-pine-500 focus:ring-4 focus:ring-pine-500/20"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-clay-600/40 bg-clay-600/15 px-3.5 py-2.5 text-sm text-clay-50">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-pine-600 py-3 text-sm font-semibold text-white transition hover:bg-pine-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pine-500/30 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in to platform'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/35">
          This is the operator console, separate from the Ɔbɔfo user app.
        </p>
      </div>
    </div>
  );
}
