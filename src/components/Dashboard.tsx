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

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  connected: { text: 'Connected', className: 'bg-emerald-100 text-emerald-700' },
  linking: { text: 'Linking…', className: 'bg-amber-100 text-amber-700' },
  logged_out: { text: 'Logged out', className: 'bg-red-100 text-red-700' },
  disconnected: { text: 'Not linked', className: 'bg-slate-200 text-slate-600' },
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

  if (!me) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  const status = STATUS_LABEL[me.session.status] ?? STATUS_LABEL.disconnected;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold tracking-tight text-emerald-700">Ɔbɔfo</div>
          <p className="text-sm text-slate-500">{me.user.email}</p>
        </div>
        <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-slate-800">
          Sign out
        </button>
      </header>

      {/* WhatsApp connection */}
      <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Your WhatsApp</h2>
            <p className="mt-1 text-sm text-slate-500">
              {me.session.phoneNumber ? `+${me.session.phoneNumber}` : 'Link the account you want us to watch.'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>{status.text}</span>
        </div>
        <div className="mt-4">
          <Link
            href="/link"
            className="inline-block rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            {me.session.status === 'connected' ? 'Re-link / manage' : 'Link WhatsApp'}
          </Link>
        </div>
      </section>

      <WatchlistCard entries={me.watchlist} onChange={load} />
      <ChannelsCard channels={me.channels} onChange={load} />
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
      setError((await res.json().catch(() => ({}))).error || 'Could not add.');
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
    <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">Watched contacts</h2>
      <p className="mt-1 text-sm text-slate-500">Alerts fire when these people or groups message or call you.</p>

      <ul className="mt-4 divide-y divide-slate-100">
        {entries.length === 0 && <li className="py-3 text-sm text-slate-400">Nothing watched yet.</li>}
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-3">
            <div>
              <span className="font-medium text-slate-800">{e.label || describeValue(e)}</span>
              <span className="ml-2 text-sm text-slate-400">{describeType(e)}</span>
            </div>
            <button onClick={() => remove(e.id)} className="text-sm text-slate-400 hover:text-red-600">
              Remove
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[130px_1fr_1fr_auto]">
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
        <input className="input" placeholder="Label (e.g. Mum)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button
          disabled={busy}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
        >
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
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
      setError((await res.json().catch(() => ({}))).error || 'Could not add.');
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
    <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">Where to alert you</h2>
      <p className="mt-1 text-sm text-slate-500">We&apos;ll send an email and/or SMS to these when a watched contact reaches you.</p>

      <ul className="mt-4 divide-y divide-slate-100">
        {channels.length === 0 && <li className="py-3 text-sm text-slate-400">No alert destinations yet.</li>}
        {channels.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3">
            <div>
              <span className="font-medium text-slate-800">{c.type === 'sms' ? `+${c.destination}` : c.destination}</span>
              <span className="ml-2 text-sm uppercase tracking-wide text-slate-400">{c.type}</span>
            </div>
            <button onClick={() => remove(c.id)} className="text-sm text-slate-400 hover:text-red-600">
              Remove
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[130px_1fr_auto]">
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
        <button
          disabled={busy}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
        >
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function describeValue(e: WatchlistEntry): string {
  if (e.type === 'number') return `+${e.value}`;
  return e.value;
}
function describeType(e: WatchlistEntry): string {
  if (e.type === 'number') return 'contact';
  if (e.type === 'group_name') return 'group';
  return 'group';
}
