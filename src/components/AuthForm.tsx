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
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {/* Compact wordmark for narrow screens where the brand panel is hidden */}
          <div className="mb-8 lg:hidden">
            <span className="font-display text-2xl font-semibold text-brand-700">Ɔbɔfo</span>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1.5 text-sm text-ink/55">
            {isSignup
              ? 'Set up Ɔbɔfo and choose who you want to hear from.'
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

          <p className="mt-6 text-center text-sm text-ink/55">
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
    </div>
  );
}

/* The characteristic thing about Ɔbɔfo: a message reaching you on a calmer
   channel. The panel shows that relay, in the watched-green world. */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-ink px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            'radial-gradient(620px circle at 15% 0%, rgba(109,92,230,0.42), transparent 55%), radial-gradient(700px circle at 90% 90%, rgba(233,162,59,0.14), transparent 50%)',
        }}
      />

      <div className="relative">
        <span className="font-display text-3xl font-semibold tracking-tight">Ɔbɔfo</span>
        <p className="mt-1 text-sm text-white/45">The herald for your WhatsApp.</p>
      </div>

      <div className="relative">
        <RelayMark />
        <h2 className="mt-10 max-w-sm font-display text-3xl font-medium leading-snug tracking-tight">
          The people who matter reach you — even when WhatsApp is closed.
        </h2>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/55">
          Pick the contacts and groups worth interrupting for. When they message or call,
          Ɔbɔfo sends the alert to your email or phone.
        </p>
      </div>

      <dl className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
        <Stat value="You choose" label="Who gets through" />
        <Stat value="Email · SMS" label="Where alerts land" />
        <Stat value="No app open" label="Nothing to watch" />
      </dl>
    </aside>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-base font-semibold text-signal-500">{value}</dt>
      <dd className="mt-0.5 text-xs leading-snug text-white/50">{label}</dd>
    </div>
  );
}

function RelayMark() {
  return (
    <svg
      viewBox="0 0 260 96"
      className="h-24 w-auto"
      fill="none"
      aria-hidden
      role="presentation"
    >
      {/* source: a watched contact */}
      <circle cx="34" cy="48" r="22" fill="#0b4534" stroke="#12885f" strokeWidth="1.5" />
      <path
        d="M34 37c-6.6 0-12 4.9-12 11 0 2.2.7 4.2 1.9 5.9L22 60l6.4-1.7c1.7.9 3.6 1.4 5.6 1.4 6.6 0 12-4.9 12-11s-5.4-10.7-12-10.7Z"
        fill="#12885f"
      />
      {/* relay path */}
      <path
        d="M62 48h132"
        stroke="#e9a23b"
        strokeWidth="2"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      {/* signal rings midway */}
      <circle cx="128" cy="48" r="9" fill="#e9a23b" />
      <circle cx="128" cy="48" r="17" stroke="#e9a23b" strokeWidth="1.5" opacity="0.5" />
      <circle cx="128" cy="48" r="25" stroke="#e9a23b" strokeWidth="1.5" opacity="0.22" />
      {/* destination: your inbox */}
      <rect x="204" y="30" width="44" height="36" rx="7" fill="#ffffff" />
      <path d="M208 37l18 13 18-13" stroke="#0b211c" strokeWidth="2" strokeLinejoin="round" fill="none" />
    </svg>
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
