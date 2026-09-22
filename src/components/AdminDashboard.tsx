'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog, { type ConfirmSpec } from '@/components/ConfirmDialog';
import { Pagination, usePagination } from '@/components/Pagination';

interface AdminUser {
  id: string;
  name: string | null;
  email: string; // masked
  role: string;
  active: boolean;
  alertsPaused: boolean;
  createdAt: string;
  status: string;
  phone: string | null; // masked
  lastConnectedAt: string | null;
  risk: 'none' | 'ok' | 'warn' | 'expired';
  daysLeft: number | null;
  counts: { watchlist: number; channels: number; alerts: number };
}
interface Totals {
  users: number;
  active: number;
  disabled: number;
  admins: number;
  connected: number;
  loggedOut: number;
  unlinked: number;
  atRisk: number;
  paused: number;
  alertsTotal: number;
  alerts24h: number;
}
interface Overview {
  me: { id: string };
  totals: Totals;
  users: AdminUser[];
}

type NavKey = 'overview' | 'users' | 'team';

const STATUS_PILL: Record<string, string> = {
  connected: 'bg-pine-50 text-pine-700 ring-pine-600/20',
  linking: 'bg-signal-50 text-signal-700 ring-signal-600/20',
  logged_out: 'bg-clay-50 text-clay-700 ring-clay-600/20',
  disconnected: 'bg-ink/5 text-ink/55 ring-ink/10',
};
const STATUS_TEXT: Record<string, string> = {
  connected: 'Connected',
  linking: 'Linking',
  logged_out: 'Logged out',
  disconnected: 'Not linked',
};

const USER_FILTERS: { key: string; label: string; test: (u: AdminUser) => boolean }[] = [
  { key: 'all', label: 'All statuses', test: () => true },
  { key: 'connected', label: 'Connected', test: (u) => u.status === 'connected' },
  { key: 'unlinked', label: 'Not linked', test: (u) => u.status === 'disconnected' || u.status === 'linking' },
  { key: 'logged_out', label: 'Logged out', test: (u) => u.status === 'logged_out' },
  { key: 'at_risk', label: 'At risk of unlink', test: (u) => u.risk === 'warn' || u.risk === 'expired' },
  { key: 'paused', label: 'Alerts paused', test: (u) => u.alertsPaused },
  { key: 'disabled', label: 'Disabled', test: (u) => !u.active },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [nav, setNav] = useState<NavKey>('overview');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/platform/overview');
    if (res.status === 403 || res.status === 401) {
      router.push('/platform/login');
      return;
    }
    if (!res.ok) {
      setError('Could not load the platform console.');
      return;
    }
    setData(await res.json());
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function logout() {
    await fetch('/api/platform/logout', { method: 'POST' });
    router.push('/platform/login');
    router.refresh();
  }

  async function runAction(run: () => Promise<Response>) {
    setBusy(true);
    setError('');
    const res = await run();
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'That action could not be completed.');
      return;
    }
    setConfirm(null);
    await load();
  }

  const patch = (id: string, body: Record<string, unknown>) => () =>
    runAction(() =>
      fetch(`/api/platform/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  const unlink = (id: string) => () => runAction(() => fetch(`/api/platform/users/${id}/unlink`, { method: 'POST' }));
  const del = (id: string) => () => runAction(() => fetch(`/api/platform/users/${id}`, { method: 'DELETE' }));

  // Build the confirmation each action opens.
  function actionsFor(u: AdminUser, context: 'app' | 'team'): UserAction[] {
    const who = <span className="font-medium text-ink">{u.name || u.email}</span>;
    const list: UserAction[] = [];

    list.push({
      label: u.active ? 'Disable' : 'Enable',
      spec: {
        title: u.active ? 'Disable this account?' : 'Enable this account?',
        confirmLabel: u.active ? 'Disable account' : 'Enable account',
        tone: u.active ? 'danger' : 'default',
        description: u.active ? (
          <>Signing in is blocked for {who} and their WhatsApp session is stopped until re-enabled.</>
        ) : (
          <>{who} will be able to sign in again.</>
        ),
        onConfirm: patch(u.id, { active: !u.active }),
      },
    });

    list.push({
      label: u.role === 'admin' ? 'Remove admin' : 'Make admin',
      spec: {
        title: u.role === 'admin' ? 'Remove admin access?' : 'Grant admin access?',
        confirmLabel: u.role === 'admin' ? 'Remove admin' : 'Make admin',
        tone: u.role === 'admin' ? 'danger' : 'default',
        description:
          u.role === 'admin' ? (
            <>{who} becomes a regular app user and loses access to this platform console.</>
          ) : (
            <>{who} gains full access to this platform console, including managing other accounts.</>
          ),
        onConfirm: patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }),
      },
    });

    if (context === 'app' && u.status !== 'disconnected') {
      list.push({
        label: 'Force unlink',
        spec: {
          title: 'Force-unlink WhatsApp?',
          confirmLabel: 'Force unlink',
          tone: 'danger',
          description: <>The linked device for {who} is removed. Alerts stop until they link WhatsApp again.</>,
          onConfirm: unlink(u.id),
        },
      });
    }

    list.push({
      danger: true,
      label: 'Delete',
      spec: {
        title: 'Delete this account?',
        confirmLabel: 'Delete account',
        tone: 'danger',
        description: (
          <>
            Permanently removes {who} along with their WhatsApp session, watchlist, destinations, and activity.
            This can’t be undone.
          </>
        ),
        onConfirm: del(u.id),
      },
    });

    return list;
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink/45">
        {error || 'Loading platform console…'}
      </div>
    );
  }

  const appUsers = data.users.filter((u) => u.role !== 'admin');
  const team = data.users.filter((u) => u.role === 'admin');
  const navItems: { key: NavKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'App users', count: appUsers.length },
    { key: 'team', label: 'Team', count: team.length },
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      {/* Dark operator sidebar — deliberately distinct from the light user app */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink text-white lg:flex">
        <div className="px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-semibold tracking-tight">Ɔbɔfo</span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70 ring-1 ring-inset ring-white/15">
              Platform
            </span>
          </div>
          <p className="mt-1 text-xs text-white/40">Operator console</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setNav(item.key)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                nav === item.key ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/70">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 border-b border-line bg-white/85 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold tracking-tight text-ink">Ɔbɔfo</span>
              <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Platform
              </span>
            </div>
            <button onClick={logout} className="text-sm font-medium text-ink/60 hover:text-ink">
              Sign out
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setNav(item.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  nav === item.key ? 'bg-ink text-white' : 'text-ink/55'
                }`}
              >
                {item.label} {item.count !== undefined ? `(${item.count})` : ''}
              </button>
            ))}
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {error && (
            <p className="mb-5 rounded-lg border border-clay-600/20 bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700">
              {error}
            </p>
          )}

          {nav === 'overview' && <OverviewSection totals={data.totals} onSeeUsers={() => setNav('users')} />}
          {nav === 'users' && (
            <UsersSection
              title="App users"
              subtitle="People using Ɔbɔfo to watch their WhatsApp. Manage their access and linked devices."
              users={appUsers}
              context="app"
              meId={data.me.id}
              showFilters
              actionsFor={actionsFor}
              onOpen={setConfirm}
            />
          )}
          {nav === 'team' && (
            <UsersSection
              title="Team"
              subtitle="System administrators with access to this platform console."
              users={team}
              context="team"
              meId={data.me.id}
              actionsFor={actionsFor}
              onOpen={setConfirm}
            />
          )}
        </main>
      </div>

      <ConfirmDialog spec={confirm} busy={busy} onClose={() => !busy && setConfirm(null)} />
    </div>
  );
}

/* ------------------------------ Overview ------------------------------ */

function OverviewSection({ totals, onSeeUsers }: { totals: Totals; onSeeUsers: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">System overview</h1>
        <p className="mt-1 text-sm text-ink/55">
          Health across every account. Personal identifiers are masked — you manage accounts without reading
          private data.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricGroup title="Accounts" accent="pine">
          <Metric value={totals.users} label="Total users" />
          <Metric value={totals.active} label="Active" />
          <Metric value={totals.disabled} label="Disabled" tone={totals.disabled ? 'clay' : undefined} />
          <Metric value={totals.admins} label="Admins" />
        </MetricGroup>

        <MetricGroup title="WhatsApp sessions" accent="pine">
          <Metric value={totals.connected} label="Connected" tone="pine" />
          <Metric value={totals.unlinked} label="Not linked" />
          <Metric value={totals.loggedOut} label="Logged out" tone={totals.loggedOut ? 'clay' : undefined} />
          <Metric value={totals.atRisk} label="At risk (14d)" tone={totals.atRisk ? 'signal' : undefined} />
        </MetricGroup>

        <MetricGroup title="Alerts" accent="signal">
          <Metric value={totals.alerts24h} label="Last 24 hours" />
          <Metric value={totals.alertsTotal} label="All time" />
          <Metric value={totals.paused} label="Users paused" tone={totals.paused ? 'signal' : undefined} />
        </MetricGroup>
      </div>

      <button
        onClick={onSeeUsers}
        className="btn-ghost"
      >
        Manage app users
      </button>
    </div>
  );
}

function MetricGroup({ title, accent, children }: { title: string; accent: 'pine' | 'signal'; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex items-center gap-2 px-5 pt-4">
        <span className={`h-4 w-1 rounded-full ${accent === 'pine' ? 'bg-pine-600' : 'bg-signal-500'}`} />
        <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden">{children}</div>
    </section>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone?: 'pine' | 'signal' | 'clay' }) {
  const color =
    tone === 'pine' ? 'text-pine-700' : tone === 'signal' ? 'text-signal-600' : tone === 'clay' ? 'text-clay-600' : 'text-ink';
  return (
    <div className="px-5 py-4">
      <p className={`font-display text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-sm text-ink/50">{label}</p>
    </div>
  );
}

/* ------------------------------- Users -------------------------------- */

interface UserAction {
  label: string;
  spec: ConfirmSpec;
  danger?: boolean;
}

function UsersSection({
  title,
  subtitle,
  users,
  context,
  meId,
  showFilters,
  actionsFor,
  onOpen,
}: {
  title: string;
  subtitle: string;
  users: AdminUser[];
  context: 'app' | 'team';
  meId: string;
  showFilters?: boolean;
  actionsFor: (u: AdminUser, context: 'app' | 'team') => UserAction[];
  onOpen: (spec: ConfirmSpec) => void;
}) {
  const [query, setQuery] = useState('');
  const [statusKey, setStatusKey] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = USER_FILTERS.find((f) => f.key === statusKey)?.test ?? (() => true);
    return users.filter(
      (u) => (!q || (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) && test(u),
    );
  }, [users, query, statusKey]);

  const paged = usePagination(filtered, 10, `${query}|${statusKey}`);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/55">{subtitle}</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        {/* Toolbar: search + filter */}
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3-3" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="input pl-9"
              placeholder={`Search ${title.toLowerCase()} by name or email…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {showFilters && (
            <select
              className="input sm:w-52"
              value={statusKey}
              onChange={(e) => setStatusKey(e.target.value)}
            >
              {USER_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-ink/45">
            No {title.toLowerCase()} match your filters.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium text-ink/45">
                    <th className="px-5 py-3 font-medium">{context === 'team' ? 'Administrator' : 'User'}</th>
                    {context === 'app' && <th className="px-3 py-3 font-medium">WhatsApp</th>}
                    {context === 'app' && <th className="px-3 py-3 font-medium">Setup</th>}
                    <th className="px-3 py-3 font-medium">Joined</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paged.pageItems.map((u) => (
                    <tr key={u.id} className={u.active ? '' : 'bg-clay-50/40'}>
                      <td className="px-5 py-3.5">
                        <IdentityCell u={u} isMe={u.id === meId} />
                      </td>
                      {context === 'app' && (
                        <td className="px-3 py-3.5">
                          <StatusCell u={u} />
                        </td>
                      )}
                      {context === 'app' && (
                        <td className="px-3 py-3.5 text-xs text-ink/60">
                          <div>{u.counts.watchlist} watched</div>
                          <div>{u.counts.channels} destinations</div>
                          {u.alertsPaused && <div className="font-medium text-signal-700">Alerts paused</div>}
                        </td>
                      )}
                      <td className="px-3 py-3.5 text-xs text-ink/55">{joined(u.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <ActionButtons u={u} context={context} isMe={u.id === meId} actionsFor={actionsFor} onOpen={onOpen} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line lg:hidden">
              {paged.pageItems.map((u) => (
                <li key={u.id} className={`p-4 ${u.active ? '' : 'bg-clay-50/40'}`}>
                  <IdentityCell u={u} isMe={u.id === meId} />
                  {context === 'app' && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/60">
                      <StatusCell u={u} />
                      <span>{u.counts.watchlist} watched</span>
                      <span>{u.counts.channels} destinations</span>
                      {u.alertsPaused && <span className="font-medium text-signal-700">Paused</span>}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <ActionButtons u={u} context={context} isMe={u.id === meId} actionsFor={actionsFor} onOpen={onOpen} />
                  </div>
                </li>
              ))}
            </ul>

            <Pagination paged={paged} noun={context === 'team' ? 'admins' : 'users'} />
          </>
        )}
      </section>
    </div>
  );
}

function IdentityCell({ u, isMe }: { u: AdminUser; isMe: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{u.name || 'Unnamed'}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
            u.role === 'admin' ? 'bg-ink/90 text-white ring-ink' : 'bg-ink/5 text-ink/60 ring-ink/10'
          }`}
        >
          {u.role === 'admin' ? 'Admin' : 'Member'}
        </span>
        {isMe && <span className="rounded bg-pine-50 px-1.5 py-0.5 text-xs font-semibold text-pine-700">You</span>}
        {!u.active && <span className="rounded bg-clay-50 px-1.5 py-0.5 text-xs font-semibold text-clay-700">Disabled</span>}
      </div>
      <div className="mt-0.5 text-xs text-ink/45">{u.email}</div>
    </div>
  );
}

function StatusCell({ u }: { u: AdminUser }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
          STATUS_PILL[u.status] ?? STATUS_PILL.disconnected
        }`}
      >
        {STATUS_TEXT[u.status] ?? u.status}
      </span>
      {u.phone && <span className="text-xs text-ink/45">{u.phone}</span>}
      {(u.risk === 'warn' || u.risk === 'expired') && (
        <span className="text-xs font-medium text-signal-700">
          {u.risk === 'expired' ? 'Unlinked (14d)' : `~${u.daysLeft}d to unlink`}
        </span>
      )}
    </div>
  );
}

function ActionButtons({
  u,
  context,
  isMe,
  actionsFor,
  onOpen,
}: {
  u: AdminUser;
  context: 'app' | 'team';
  isMe: boolean;
  actionsFor: (u: AdminUser, context: 'app' | 'team') => UserAction[];
  onOpen: (spec: ConfirmSpec) => void;
}) {
  if (isMe) return <span className="text-xs text-ink/35">Your account</span>;
  return (
    <>
      {actionsFor(u, context).map((a) => (
        <button
          key={a.label}
          onClick={() => onOpen(a.spec)}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            a.danger
              ? 'border-clay-600/25 text-clay-700 hover:bg-clay-50'
              : 'border-line text-ink/70 hover:border-ink/25 hover:text-ink'
          }`}
        >
          {a.label}
        </button>
      ))}
    </>
  );
}

function joined(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}
