'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/overview');
    if (res.status === 403 || res.status === 401) {
      router.push('/');
      return;
    }
    if (!res.ok) {
      setError('Could not load the admin console.');
      return;
    }
    setData(await res.json());
  }, [router]);

  useEffect(() => {
    // Initial load; setState runs only after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(id: string, run: () => Promise<Response>) {
    setBusyId(id);
    setError('');
    const res = await run();
    setBusyId(null);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'That action failed.');
      return false;
    }
    await load();
    return true;
  }

  const patch = (id: string, body: Record<string, unknown>) =>
    act(id, () =>
      fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  const unlink = (id: string) => act(id, () => fetch(`/api/admin/users/${id}/unlink`, { method: 'POST' }));

  async function doDelete(id: string) {
    const ok = await act(id, () => fetch(`/api/admin/users/${id}`, { method: 'DELETE' }));
    if (ok) setConfirmDelete(null);
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter((u) => (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [data, query]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink/45">
        {error || 'Loading admin console…'}
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-xl font-semibold tracking-tight text-pine-700">Ɔbɔfo</span>
            <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
              Admin
            </span>
          </div>
          <Link href="/" className="text-sm font-medium text-ink/60 hover:text-ink">
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">System overview</h1>
          <p className="mt-1 text-sm text-ink/55">
            Manage accounts and watch the health of every WhatsApp session. Personal identifiers are
            masked — you can act on an account without reading its private data.
          </p>
        </div>

        {/* System health */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric label="Total users" value={t.users} sub={`${t.active} active · ${t.disabled} disabled`} />
          <Metric label="Connected now" value={t.connected} sub={`${t.unlinked} not linked`} tone="pine" />
          <Metric label="At risk of unlink" value={t.atRisk} sub={`${t.loggedOut} logged out`} tone={t.atRisk ? 'signal' : undefined} />
          <Metric label="Alerts (24h)" value={t.alerts24h} sub={`${t.alertsTotal} all-time`} />
        </div>

        {error && (
          <p className="mt-5 rounded-lg border border-clay-600/20 bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700">
            {error}
          </p>
        )}

        {/* Users */}
        <section className="mt-8 panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-semibold text-ink">Users</h2>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink/55">{filtered.length}</span>
            </div>
            <input
              className="input sm:w-64"
              placeholder="Search name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-3 py-3 font-semibold">Role</th>
                  <th className="px-3 py-3 font-semibold">WhatsApp</th>
                  <th className="px-3 py-3 font-semibold">Config</th>
                  <th className="px-3 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((u) => {
                  const isMe = u.id === data.me.id;
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id} className={u.active ? '' : 'bg-clay-50/40'}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{u.name || 'Unnamed'}</span>
                          {isMe && <span className="rounded bg-pine-50 px-1.5 py-0.5 text-xs font-semibold text-pine-700">You</span>}
                          {!u.active && <span className="rounded bg-clay-50 px-1.5 py-0.5 text-xs font-semibold text-clay-700">Disabled</span>}
                        </div>
                        <div className="text-xs text-ink/45">{u.email}</div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                            u.role === 'admin' ? 'bg-ink/90 text-white ring-ink' : 'bg-ink/5 text-ink/60 ring-ink/10'
                          }`}
                        >
                          {u.role === 'admin' ? 'Admin' : 'Member'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_PILL[u.status] ?? STATUS_PILL.disconnected}`}>
                            {STATUS_TEXT[u.status] ?? u.status}
                          </span>
                          {u.phone && <span className="text-xs text-ink/45">{u.phone}</span>}
                          {(u.risk === 'warn' || u.risk === 'expired') && (
                            <span className="text-xs font-medium text-signal-700">
                              {u.risk === 'expired' ? 'Unlinked (14d)' : `~${u.daysLeft}d to unlink`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-ink/60">
                        <div>{u.counts.watchlist} watched</div>
                        <div>{u.counts.channels} destinations</div>
                        {u.alertsPaused && <div className="font-medium text-signal-700">Paused</div>}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-ink/55">
                        {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {isMe ? (
                            <span className="text-xs text-ink/35">—</span>
                          ) : (
                            <>
                              <RowAction disabled={busy} onClick={() => patch(u.id, { active: !u.active })}>
                                {u.active ? 'Disable' : 'Enable'}
                              </RowAction>
                              <RowAction disabled={busy} onClick={() => patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}>
                                {u.role === 'admin' ? 'Make member' : 'Make admin'}
                              </RowAction>
                              <RowAction disabled={busy || u.status === 'disconnected'} onClick={() => unlink(u.id)}>
                                Force unlink
                              </RowAction>
                              <RowAction disabled={busy} danger onClick={() => setConfirmDelete(u)}>
                                Delete
                              </RowAction>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-ink/45">
                      No users match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {confirmDelete && (
        <ConfirmDelete
          user={confirmDelete}
          busy={busyId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => doDelete(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'pine' | 'signal';
}) {
  const valueColor = tone === 'pine' ? 'text-pine-700' : tone === 'signal' ? 'text-signal-600' : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</p>
      <p className={`mt-1.5 font-display text-3xl font-semibold ${valueColor}`}>{value}</p>
      <p className="mt-0.5 text-xs text-ink/45">{sub}</p>
    </div>
  );
}

function RowAction({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'border-clay-600/25 text-clay-700 hover:bg-clay-50'
          : 'border-line text-ink/70 hover:border-ink/25 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function ConfirmDelete({
  user,
  busy,
  onCancel,
  onConfirm,
}: {
  user: AdminUser;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-semibold text-ink">Delete this account?</h3>
        <p className="mt-2 text-sm text-ink/60">
          This permanently removes <span className="font-medium text-ink">{user.name || user.email}</span> along with
          their WhatsApp session, watchlist, destinations, and activity. This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-ghost" disabled={busy}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-lg bg-clay-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-clay-700 disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>
  );
}
