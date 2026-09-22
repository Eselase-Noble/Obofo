'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deviceRisk, type DeviceRiskLevel } from '@/lib/core/device';
import LinkPanel from '@/components/LinkPanel';

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
interface AlertEvent {
  id: string;
  kind: 'message' | 'call' | string;
  who: string;
  channels: number;
  createdAt: string;
}
interface Me {
  user: { email: string; name: string | null; role: string; alertsPaused: boolean };
  session: { status: string; phoneNumber: string | null; lastConnectedAt: string | null };
  watchlist: WatchlistEntry[];
  channels: Channel[];
  alerts: AlertEvent[];
}

type NavKey = 'overview' | 'contacts' | 'destinations' | 'settings';

const NAV: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <IconGrid /> },
  { key: 'contacts', label: 'Watched contacts', icon: <IconUsers /> },
  { key: 'destinations', label: 'Alert destinations', icon: <IconInbox /> },
  { key: 'settings', label: 'Settings', icon: <IconCog /> },
];

const STATUS: Record<string, { text: string; dot: string; pill: string; live: boolean }> = {
  connected: { text: 'Watching', dot: 'bg-pine-500', pill: 'bg-pine-50 text-pine-700 ring-pine-600/20', live: true },
  linking: { text: 'Linking…', dot: 'bg-signal-500', pill: 'bg-signal-50 text-signal-700 ring-signal-600/20', live: false },
  logged_out: { text: 'Signed out of WhatsApp', dot: 'bg-clay-600', pill: 'bg-clay-50 text-clay-700 ring-clay-600/20', live: false },
  disconnected: { text: 'Not linked', dot: 'bg-ink/30', pill: 'bg-ink/5 text-ink/60 ring-ink/10', live: false },
};

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [nav, setNav] = useState<NavKey>('overview');
  // Linking is shown inline within this shell rather than on a separate route.
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/me');
    if (res.status === 401) {
      router.push('/login');
      return;
    }
    setMe(await res.json());
  }, [router]);

  useEffect(() => {
    // Initial + refetch loads. setMe only runs after the fetch resolves, so this
    // isn't a synchronous cascading render despite the lint rule's heuristic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
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

  const activeLabel = linking ? 'Link WhatsApp' : NAV.find((n) => n.key === nav)?.label ?? '';
  const goLink = () => setLinking(true);
  const selectNav = (k: NavKey) => {
    setLinking(false);
    setNav(k);
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white lg:flex">
        <div className="px-6 py-5">
          <span className="font-display text-xl font-semibold tracking-tight text-pine-700">Ɔbɔfo</span>
          <p className="mt-0.5 text-xs text-ink/45">Your WhatsApp herald</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavButton key={item.key} item={item} active={!linking && nav === item.key} onClick={() => selectNav(item.key)} />
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="rounded-lg px-3 py-2">
            <p className="truncate text-sm font-medium text-ink">{me.user.name || 'Your account'}</p>
            <p className="truncate text-xs text-ink/45">{me.user.email}</p>
          </div>
          <button
            onClick={logout}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink/60 transition hover:bg-paper hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-line bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="font-display text-lg font-semibold tracking-tight text-pine-700 lg:hidden">Ɔbɔfo</span>
              <h1 className="hidden font-display text-lg font-semibold text-ink lg:block">{activeLabel}</h1>
            </div>
            <div className="flex items-center gap-3">
              {me.user.alertsPaused && (
                <span className="rounded-full bg-signal-50 px-2.5 py-1 text-xs font-semibold text-signal-700 ring-1 ring-inset ring-signal-600/20">
                  Alerts paused
                </span>
              )}
              <button onClick={logout} className="text-sm font-medium text-ink/60 hover:text-ink lg:hidden">
                Sign out
              </button>
            </div>
          </div>
          {/* Mobile nav */}
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => selectNav(item.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  !linking && nav === item.key ? 'bg-pine-50 text-pine-700' : 'text-ink/55'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {linking ? (
            <LinkPanel
              onBack={() => setLinking(false)}
              onConnected={() => {
                setLinking(false);
                void load();
              }}
            />
          ) : (
            <>
              {nav === 'overview' && <Overview me={me} onGo={selectNav} onLink={goLink} />}
              {nav === 'contacts' && <WatchlistCard entries={me.watchlist} onChange={load} />}
              {nav === 'destinations' && <ChannelsCard channels={me.channels} onChange={load} />}
              {nav === 'settings' && <Settings me={me} onChange={load} onLogout={logout} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: (typeof NAV)[number]; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active ? 'bg-pine-50 text-pine-700' : 'text-ink/60 hover:bg-paper hover:text-ink'
      }`}
    >
      <span className={active ? 'text-pine-600' : 'text-ink/40'}>{item.icon}</span>
      {item.label}
    </button>
  );
}

/* ---------------------------- Overview -------------------------------- */

function Overview({ me, onGo, onLink }: { me: Me; onGo: (k: NavKey) => void; onLink: () => void }) {
  const connected = me.session.status === 'connected';
  const status = STATUS[me.session.status] ?? STATUS.disconnected;
  const risk = deviceRisk(me.session.status, me.session.lastConnectedAt);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {me.user.name ? `Hello, ${me.user.name.split(' ')[0]}` : 'Your alerts'}
        </h2>
        <p className="mt-1 text-sm text-ink/55">
          Ɔbɔfo watches the contacts you choose and tells you the moment they reach out.
        </p>
      </div>

      <DeviceWarning risk={risk.level} daysLeft={risk.daysLeft} status={me.session.status} onLink={onLink} />

      {/* Connection hero — the one bold element */}
      <section className="overflow-hidden rounded-2xl border border-pine-800 bg-ink text-white shadow-sm">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            <span className={`grid h-11 w-11 place-items-center rounded-full ${connected ? 'bg-pine-600' : 'bg-white/10'}`}>
              <span className={`h-3 w-3 rounded-full ${status.dot} ${status.live ? 'signal-live' : ''}`} />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium uppercase tracking-wide text-white/45">WhatsApp connection</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${status.pill}`}>
                  {status.text}
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-medium text-white">
                {me.session.phoneNumber ? `+${me.session.phoneNumber}` : 'No WhatsApp linked yet'}
              </p>
            </div>
          </div>
          <button
            onClick={onLink}
            className={
              connected
                ? 'btn-ghost border-white/20 bg-white/5 text-white hover:border-white/40 hover:text-white'
                : 'inline-flex items-center justify-center rounded-lg bg-signal-500 px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-signal-500/90'
            }
          >
            {connected ? 'Manage link' : 'Link WhatsApp'}
          </button>
        </div>
      </section>

      {/* At-a-glance summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Watched" value={me.watchlist.length} hint="contacts & groups" onClick={() => onGo('contacts')} />
        <StatTile label="Destinations" value={me.channels.length} hint="email / SMS" onClick={() => onGo('destinations')} />
        <StatTile label="Recent alerts" value={me.alerts.length} hint="last shown here" />
        <StatTile
          label="Last synced"
          value={risk.daysSince === null ? '—' : risk.daysSince === 0 ? 'Today' : `${risk.daysSince}d`}
          hint={connected ? 'phone online' : 'not linked'}
        />
      </div>

      <RecentAlerts alerts={me.alerts} />
    </div>
  );
}

function DeviceWarning({
  risk,
  daysLeft,
  status,
  onLink,
}: {
  risk: DeviceRiskLevel;
  daysLeft: number | null;
  status: string;
  onLink: () => void;
}) {
  if (risk === 'ok' || risk === 'none') return null;

  const expired = risk === 'expired' || status === 'logged_out';
  const tone = expired
    ? 'border-clay-600/25 bg-clay-50 text-clay-700'
    : 'border-signal-600/25 bg-signal-50 text-signal-700';

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${tone}`}>
      <span className="mt-0.5 shrink-0">
        <IconAlert />
      </span>
      <div className="text-sm">
        <p className="font-semibold">
          {expired
            ? 'WhatsApp has unlinked this device'
            : `Reconnect soon — about ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
        </p>
        <p className="mt-0.5 leading-relaxed opacity-90">
          {expired ? (
            <>
              Alerts have stopped. WhatsApp signs out linked devices after ~14 days.{' '}
              <button onClick={onLink} className="font-semibold underline underline-offset-2">
                Link again
              </button>{' '}
              to resume.
            </>
          ) : (
            'WhatsApp unlinks a device after ~14 days with your phone offline. Open WhatsApp on your phone so it re-syncs and alerts keep flowing.'
          )}
        </p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: number | string;
  hint: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl border border-line bg-white p-4 text-left ${
        onClick ? 'transition hover:border-ink/20 hover:shadow-sm' : ''
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink/45">{hint}</p>
    </Tag>
  );
}

function RecentAlerts({ alerts }: { alerts: AlertEvent[] }) {
  return (
    <section className="panel">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h3 className="font-display text-base font-semibold text-ink">Recent activity</h3>
        <span className="text-xs text-ink/45">Message contents are never stored</span>
      </div>
      {alerts.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-ink/45">
          No alerts yet. When a watched contact reaches you, it shows up here.
        </p>
      ) : (
        <ul className="divide-y divide-line px-6">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3.5">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                  a.kind === 'call' ? 'bg-signal-50 text-signal-700' : 'bg-pine-50 text-pine-700'
                }`}
              >
                {a.kind === 'call' ? <IconPhone /> : <IconChat />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {a.who} {a.kind === 'call' ? 'called you' : 'messaged you'}
                </p>
                <p className="text-xs text-ink/45">
                  {relativeTime(a.createdAt)}
                  {a.channels > 0 && ` · alerted ${a.channels} destination${a.channels === 1 ? '' : 's'}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------- Settings -------------------------------- */

function Settings({ me, onChange, onLogout }: { me: Me; onChange: () => void; onLogout: () => void }) {
  const [saving, setSaving] = useState(false);

  async function togglePause() {
    setSaving(true);
    await fetch('/api/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertsPaused: !me.user.alertsPaused }),
    });
    setSaving(false);
    onChange();
  }

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-ink">Pause alerts</h3>
            <p className="mt-1 max-w-md text-sm text-ink/55">
              Temporarily stop all alerts without unlinking WhatsApp. Your contacts and destinations stay saved.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={me.user.alertsPaused}
            onClick={togglePause}
            disabled={saving}
            className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
              me.user.alertsPaused ? 'bg-signal-500' : 'bg-ink/15'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                me.user.alertsPaused ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
        {me.user.alertsPaused && (
          <p className="mt-4 rounded-lg bg-signal-50 px-3.5 py-2.5 text-sm text-signal-700">
            Alerts are paused. You won&apos;t be notified until you resume.
          </p>
        )}
      </section>

      <section className="panel p-6">
        <h3 className="font-display text-base font-semibold text-ink">Account</h3>
        <dl className="mt-4 divide-y divide-line text-sm">
          <Row label="Name" value={me.user.name || '—'} />
          <Row label="Email" value={me.user.email} />
          <Row label="Role" value={me.user.role === 'admin' ? 'Administrator' : 'Member'} />
        </dl>
        <button onClick={onLogout} className="btn-ghost mt-5">
          Sign out
        </button>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-ink/55">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

/* ------------------------- Watchlist / Channels ----------------------- */

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
        icon={<IconUsers />}
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
      <form onSubmit={add} className="grid grid-cols-1 gap-2.5 border-t border-line px-6 py-5 sm:grid-cols-[140px_1fr_1fr_auto]">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="number">Phone number</option>
          <option value="group_name">Group name</option>
        </select>
        <input className="input" placeholder={type === 'number' ? '+233…' : 'Group name'} value={value} onChange={(e) => setValue(e.target.value)} required />
        <input className="input" placeholder="Label (e.g. Mum)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button disabled={busy} className="btn-primary">Add</button>
      </form>
      {error && <p className="-mt-2 px-6 pb-5 text-sm text-clay-700">{error}</p>}
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
        icon={<IconInbox />}
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
              <span className="font-medium text-ink">{c.type === 'sms' ? `+${c.destination}` : c.destination}</span>
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
      <form onSubmit={add} className="grid grid-cols-1 gap-2.5 border-t border-line px-6 py-5 sm:grid-cols-[140px_1fr_auto]">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <input className="input" placeholder={type === 'email' ? 'you@example.com' : '+233…'} value={destination} onChange={(e) => setDestination(e.target.value)} required />
        <button disabled={busy} className="btn-primary">Add</button>
      </form>
      {error && <p className="-mt-2 px-6 pb-5 text-sm text-clay-700">{error}</p>}
    </section>
  );
}

function PanelHeader({ icon, title, hint, count }: { icon: React.ReactNode; title: string; hint: string; count: number }) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-6 py-5">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-pine-50 text-pine-700">{icon}</span>
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

/* ------------------------------ helpers ------------------------------- */

function describeValue(e: WatchlistEntry): string {
  return e.type === 'number' ? `+${e.value}` : e.value;
}
function describeType(e: WatchlistEntry): string {
  return e.type === 'number' ? 'contact' : 'group';
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ------------------------------- icons -------------------------------- */

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 6.5a3 3 0 0 1 0 5M17.5 19a5 5 0 0 0-2.2-4.1" strokeLinecap="round" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5 12 13l7.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCog() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.5M12 18.5V21M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3" strokeLinecap="round" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3.5 21 19H3l9-15.5Z" strokeLinejoin="round" />
      <path d="M12 10v4M12 16.8v.2" strokeLinecap="round" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
    </svg>
  );
}
