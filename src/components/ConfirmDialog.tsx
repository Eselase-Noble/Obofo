'use client';

import { useEffect, useRef } from 'react';

export interface ConfirmSpec {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
}

/**
 * A single reusable confirmation modal. Every impactful action routes through
 * this so nothing destructive happens on a stray click. Closes on Escape or
 * backdrop click; the primary action is focused on open.
 */
export default function ConfirmDialog({
  spec,
  busy,
  onClose,
}: {
  spec: ConfirmSpec | null;
  busy: boolean;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!spec) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, busy, onClose]);

  if (!spec) return null;

  const danger = spec.tone === 'danger';

  return (
    <div
      className="animate-fade fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={spec.title}
        onClick={(e) => e.stopPropagation()}
        className="animate-pop w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3.5">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              danger ? 'bg-clay-50 text-clay-600' : 'bg-brand-50 text-brand-700'
            }`}
          >
            {danger ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M12 3.5 21 19H3l9-15.5Z" strokeLinejoin="round" />
                <path d="M12 10v4M12 16.8v.2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16.2v.2" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold text-ink">{spec.title}</h3>
            <div className="mt-1.5 text-sm leading-relaxed text-ink/60">{spec.description}</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button onClick={onClose} disabled={busy} className="btn-ghost">
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={() => spec.onConfirm()}
            disabled={busy}
            className={
              danger
                ? 'inline-flex items-center justify-center rounded-lg bg-clay-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-clay-600/25 disabled:opacity-60'
                : 'btn-primary'
            }
          >
            {busy ? 'Working…' : spec.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
