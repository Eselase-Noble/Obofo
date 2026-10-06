'use client';

import { useState } from 'react';

/**
 * Lets a signed-in user edit their own name and sign-in email. The current
 * password is only required when the email actually changes — the input reveals
 * itself in that case so a plain name edit stays frictionless.
 */
export default function EditProfileModal({
  initialName,
  initialEmail,
  onClose,
  onDone,
}: {
  initialName: string;
  initialEmail: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== initialEmail.trim().toLowerCase();
  const nothingChanged = !emailChanged && name.trim() === initialName.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nothingChanged) return onClose();
    if (emailChanged && !currentPassword) {
      return setError('Enter your current password to change your email.');
    }
    setBusy(true);
    setError('');
    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, ...(emailChanged ? { currentPassword } : {}) }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Could not save your changes.');
      return;
    }
    onDone();
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
        <h3 className="font-display text-lg font-semibold text-ink">Edit profile</h3>
        <p className="mt-1 text-sm text-ink/55">Update your name and the email you use to sign in.</p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="label">Name</span>
            <input
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={80}
            />
          </label>

          <label className="block">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          {emailChanged && (
            <label className="block">
              <span className="label">Current password</span>
              <input
                className="input"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Confirm it's you"
                autoComplete="current-password"
              />
              <span className="mt-1.5 block text-xs text-ink/45">
                Required to change your sign-in email.
              </span>
            </label>
          )}

          {error && (
            <p className="rounded-lg border border-clay-600/20 bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700">{error}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={busy || nothingChanged} className="btn-primary">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
