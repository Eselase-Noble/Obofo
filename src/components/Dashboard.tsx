'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WatchlistEntry {
  id: string;
  type: string;
  value: string;
  label: string | null;
}
interface Channel {
  id: string;
  type: string;
  destination: string;
  enabled: boolean;
}
interface Me {
  user: { email: string; name: string | null };
  session: { status: string; phoneNumber: string | null };
  watchlist: WatchlistEntry[];
  channels: Channel[];
}

const STATUS: Record<
  string,
  { text: string; dot: string; pill: string; live: boolean }
> = {
  connected: {
    text: 'Watching',
    dot: 'bg-pine-500',
    pill: 'bg-pine-50 text-pine-700 ring-pine-600/20',
    live: true,
  },
  linking: {
    text: 'Linking…',
    dot: 'bg-signal-500',
    pill: 'bg-signal-50 text-signal-700 ring-signal-600/20',
    live: false,
  },
  logged_out: {
    text: 'Signed out of WhatsApp',
    dot: 'bg-clay-600',
    pill: 'bg-clay-50 text-clay-700 ring-clay-600/20',
    live: false,
  },
  disconnected: {
    text: 'Not linked',
    dot: 'bg-ink/30',
    pill: 'bg-ink/5 text-ink/60 ring-ink/10',
    live: false,
  },
};

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/me');
    if (res.status === 401) {
      router.push('/login');
      return;
    }
    setMe(await res.json());
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink/45">
        Loading your dashboard…
      </div>
    );
  }

  const status = STATUS[me.session.status] ?? STATUS.disconnected;
  const connected = me.session.status === 'connected';

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
          <span className="font-display text-xl font-semibold tracking-tight text-pine-700">Ɔbɔfo</span>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink/55 sm:inline">{me.user.email}</span>
            <button onClick={logout} className="text-sm font-medium text-ink/60 hover:text-ink">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {me.user.name ? `Hello, ${me.user.name}` : 'Your alerts'}
          </h1>
          <p className="mt-1 text-sm text-ink/55">
            Ɔbɔfo watches the contacts you choose and tells you the moment they reach out.
          </p>
        </div>

        {/* The one bold element: live connection state */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-pine-800 bg-ink text-white shadow-sm">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-center gap-4">
              <span
                className={`grid h-11 w-11 place-items-center rounded-full ${
                  connected ? 'bg-pine-600' : 'bg-white/10'
                }`}
              >
                <span className={`h-3 w-3 rounded-full ${status.dot} ${status.live ? 'signal-live' : ''}`} />
              </span>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/45">
                    WhatsApp connection
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${status.pill}`}
                  >
                    {status.text}
                  </span>
                </div>
                <p className="mt-1 font-display text-lg font-medium text-white">
                  {me.session.phoneNumber
                    ? `+${me.session.phoneNumber}`
                    : 'No WhatsApp linked yet'}
                </p>
              </div>
            </div>

            <Link
              href="/link"
              className={
                connected
                  ? 'btn-ghost border-white/20 bg-white/5 text-white hover:border-white/40 hover:text-white'
                  : 'inline-flex items-center justify-center rounded-lg bg-signal-500 px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-signal-500/90'
              }
            >
              {connected ? 'Manage link' : 'Link WhatsApp'}
            </Link>
          </div>
          {!connected && (
            <div className="border-t border-white/10 bg-white/[0.03] px-6 py-3 text-sm text-white/55 sm:px-7">
              Alerts stay quiet until you link the WhatsApp account you want watched.
            </div>
          )}
        </section>

        <div className="space-y-6">
          <WatchlistCard entries={me.watchlist} onChange={load} />
          <ChannelsCard channels={me.channels} onChange={load} />
        </div>
      </main>
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  hint,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  count: number;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-6 py-5">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-pine-50 text-pine-700">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink/55">{count}</span>
        </div>
        <p className="mt-0.5 text-sm text-ink/55">{hint}</p>
      </div>
    </div>
  );
}

function WatchlistCard({ entries, onChange }: { entries: WatchlistEntry[]; onChange: () => void }) {
  const [type, setType] = useState('number');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value, label }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Could not add that contact.');
      return;
    }
    setValue('');
    setLabel('');
    onChange();
  }

  async function remove(id: string) {
    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <section className="panel">
      <PanelHeader
        title="Watched contacts"
        hint="Alerts fire when these people or groups message or call you."
        count={entries.length}
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
            <path d="M16 6.5a3 3 0 0 1 0 5M17.5 19a5 5 0 0 0-2.2-4.1" strokeLinecap="round" />
          </svg>
        }
      />

      <ul className="divide-y divide-line px-6">
        {entries.length === 0 && (
          <li className="py-8 text-center text-sm text-ink/45">
            No one is being watched yet. Add a contact or group below.
          </li>
        )}
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-3.5">
            <div className="min-w-0">
              <span className="block truncate font-medium text-ink">{e.label || describeValue(e)}</span>
              <span className="text-sm text-ink/45">
                {e.label ? `${describeValue(e)} · ` : ''}
                {describeType(e)}
              </span>
            </div>
            <button
              onClick={() => remove(e.id)}
              className="ml-4 shrink-0 rounded-md px-2 py-1 text-sm font-medium text-ink/45 transition hover:bg-clay-50 hover:text-clay-700"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={add}
        className="grid grid-cols-1 gap-2.5 border-t border-line px-6 py-5 sm:grid-cols-[140px_1fr_1fr_auto]"
      >
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="number">Phone number</option>
          <option value="group_name">Group name</option>
        </select>
        <input
          className="input"
          placeholder={type === 'number' ? '+233…' : 'Group name'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Label (e.g. Mum)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button disabled={busy} className="btn-primary">
          Add
        </button>
      </form>
      {error && <p className="px-6 pb-5 -mt-2 text-sm text-clay-700">{error}</p>}
    </section>
  );
}

function ChannelsCard({ channels, onChange }: { channels: Channel[]; onChange: () => void }) {
  const [type, setType] = useState('email');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, destination }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Could not add that destination.');
      return;
    }
    setDestination('');
    onChange();
  }

  async function remove(id: string) {
    await fetch(`/api/channels/${id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <section className="panel">
      <PanelHeader
        title="Alert destinations"
        hint="Where Ɔbɔfo sends the alert when a watched contact reaches you."
        count={channels.length}
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
            <path d="M4.5 7.5 12 13l7.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />

      <ul className="divide-y divide-line px-6">
        {channels.length === 0 && (
          <li className="py-8 text-center text-sm text-ink/45">
            Add an email or phone number so alerts have somewhere to go.
          </li>
        )}
        {channels.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                  c.type === 'email' ? 'bg-pine-50 text-pine-700' : 'bg-signal-50 text-signal-700'
                }`}
              >
                {c.type}
              </span>
              <span className="font-medium text-ink">
                {c.type === 'sms' ? `+${c.destination}` : c.destination}
              </span>
            </div>
            <button
              onClick={() => remove(c.id)}
              className="ml-4 shrink-0 rounded-md px-2 py-1 text-sm font-medium text-ink/45 transition hover:bg-clay-50 hover:text-clay-700"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={add}
        className="grid grid-cols-1 gap-2.5 border-t border-line px-6 py-5 sm:grid-cols-[140px_1fr_auto]"
      >
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <input
          className="input"
          placeholder={type === 'email' ? 'you@example.com' : '+233…'}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          required
        />
        <button disabled={busy} className="btn-primary">
          Add
        </button>
      </form>
      {error && <p className="px-6 pb-5 -mt-2 text-sm text-clay-700">{error}</p>}
    </section>
  );
}

function describeValue(e: WatchlistEntry): string {
  if (e.type === 'number') return `+${e.value}`;
  return e.value;
}
function describeType(e: WatchlistEntry): string {
  if (e.type === 'number') return 'contact';
  return 'group';
}
