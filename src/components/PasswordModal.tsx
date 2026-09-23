'use client';

import { useState } from 'react';

/**
 * One modal for every password flow:
 * - Self change  → `requireCurrent`, posts { currentPassword, newPassword }.
 * - Admin reset  → posts { password }, with an optional Generate button.
 */
export default function PasswordModal({
  title,
  description,
  endpoint,
  requireCurrent = false,
  allowGenerate = false,
  onClose,
  onDone,
}: {
  title: string;
  description?: string;
  endpoint: string;
  requireCurrent?: boolean;
  allowGenerate?: boolean;
  onClose: () => void;
  onDone: (newPassword: string) => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function generate() {
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    const pw = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).padEnd(10, 'x');
    setNext(pw);
    setConfirm(pw);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) return setError('New password must be at least 6 characters.');
    if (next !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    setError('');
    const body = requireCurrent ? { currentPassword: current, newPassword: next } : { password: next };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Could not update the password.');
      return;
    }
    onDone(next);
  }

  return (
    <div
      className="animate-fade fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="animate-pop w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl"
      >
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-sm text-ink/55">{description}</p>}

        <div className="mt-5 space-y-4">
          {requireCurrent && (
            <label className="block">
              <span className="label">Current password</span>
              <input
                className="input"
                type="password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
            </label>
          )}

          <label className="block">
            <span className="label">New password</span>
            <div className="flex gap-2">
              <input
                className="input"
                type={allowGenerate ? 'text' : 'password'}
                required
                minLength={6}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
              {allowGenerate && (
                <button type="button" onClick={generate} className="btn-ghost shrink-0 px-3">
                  Generate
                </button>
              )}
            </div>
          </label>

          <label className="block">
            <span className="label">Confirm new password</span>
            <input
              className="input"
              type={allowGenerate ? 'text' : 'password'}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-clay-600/20 bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700">{error}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}
