'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

interface Status {
  status: string;
  qr: string | null;
  pairingCode: string | null;
  linkMethod: string;
  phoneNumber: string | null;
}

export default function LinkPage() {
  const router = useRouter();
  const [method, setMethod] = useState<'qr' | 'code'>('qr');
  const [phone, setPhone] = useState('');
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');

  const poll = useCallback(async () => {
    const res = await fetch('/api/link/status');
    if (res.ok) setStatus(await res.json());
  }, []);

  // Poll while linking.
  useEffect(() => {
    if (!started) return;
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [started, poll]);

  // Redirect home once connected.
  useEffect(() => {
    if (status?.status === 'connected') {
      const t = setTimeout(() => router.push('/'), 1500);
      return () => clearTimeout(t);
    }
  }, [status?.status, router]);

  async function start() {
    setError('');
    if (method === 'code' && !phone.replace(/\D/g, '')) {
      setError('Enter your WhatsApp number to get a pairing code.');
      return;
    }
    const res = await fetch('/api/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, phoneNumber: phone }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Could not start linking.');
      return;
    }
    setStarted(true);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5 sm:px-6">
          <span className="font-display text-xl font-semibold tracking-tight text-pine-700">Ɔbɔfo</span>
          <Link href="/" className="text-sm font-medium text-ink/60 hover:text-ink">
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Link your WhatsApp</h1>
        <p className="mt-1.5 max-w-lg text-sm text-ink/55">
          Connect the WhatsApp account you want Ɔbɔfo to watch. It works like WhatsApp Web — your
          messages stay on your phone.
        </p>

        <div className="mt-6 panel p-6 sm:p-7">
          {!started ? (
            <>
              <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-paper p-1">
                <MethodTab active={method === 'qr'} onClick={() => setMethod('qr')} label="Scan QR code" />
                <MethodTab active={method === 'code'} onClick={() => setMethod('code')} label="Pairing code" />
              </div>

              <label className="block">
                <span className="label">
                  Your WhatsApp number{' '}
                  {method === 'qr' && <span className="font-normal text-ink/40">(optional)</span>}
                </span>
                <input
                  className="input"
                  placeholder="+233…"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>

              {error && <p className="mt-3 text-sm text-clay-700">{error}</p>}

              <button onClick={start} className="btn-primary mt-5 w-full py-3">
                Start linking
              </button>
            </>
          ) : (
            <LinkProgress method={method} status={status} />
          )}
        </div>
      </main>
    </div>
  );
}

function LinkProgress({ method, status }: { method: 'qr' | 'code'; status: Status | null }) {
  if (status?.status === 'connected') {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-pine-50 text-pine-700">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mt-4 font-display text-lg font-semibold text-ink">You&apos;re connected</p>
        <p className="mt-1 text-sm text-ink/55">Taking you to your dashboard…</p>
      </div>
    );
  }

  if (method === 'qr') {
    return (
      <div className="text-center">
        {status?.qr ? (
          <div className="inline-block rounded-2xl border border-line bg-white p-4">
            <QRCodeSVG value={status.qr} size={220} fgColor="#0b211c" />
          </div>
        ) : (
          <div className="grid h-[252px] place-items-center text-sm text-ink/45">Generating QR code…</div>
        )}
        <Steps
          steps={[
            'Open WhatsApp on your phone.',
            'Go to Settings → Linked Devices → Link a Device.',
            'Point your phone at this code — it refreshes on its own.',
          ]}
        />
      </div>
    );
  }

  return (
    <div className="text-center">
      {status?.pairingCode ? (
        <div className="rounded-2xl border border-pine-100 bg-pine-50 py-7">
          <p className="text-sm text-ink/55">Enter this code in WhatsApp</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.35em] text-pine-700">
            {status.pairingCode}
          </p>
        </div>
      ) : (
        <div className="grid h-[132px] place-items-center text-sm text-ink/45">Requesting pairing code…</div>
      )}
      <Steps
        steps={[
          'Open WhatsApp → Linked Devices → Link a Device.',
          'Tap “Link with phone number instead”.',
          'Enter the code shown above.',
        ]}
      />
    </div>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="mx-auto mt-6 max-w-sm space-y-3 text-left">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm text-ink/70">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pine-50 text-xs font-semibold text-pine-700">
            {i + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function MethodTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-white text-pine-700 shadow-sm' : 'text-ink/55 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}
