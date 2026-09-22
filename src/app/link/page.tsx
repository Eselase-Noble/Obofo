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
      setError('Enter your WhatsApp number for the pairing-code method.');
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
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
        ← Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Link your WhatsApp</h1>
      <p className="mt-1 text-sm text-slate-500">
        Connect the WhatsApp account you want Ɔbɔfo to watch. This works just like WhatsApp Web.
      </p>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {!started && (
          <>
            <div className="mb-4 flex gap-2">
              <MethodTab active={method === 'qr'} onClick={() => setMethod('qr')} label="Scan QR" />
              <MethodTab active={method === 'code'} onClick={() => setMethod('code')} label="Pairing code" />
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Your WhatsApp number {method === 'qr' && <span className="text-slate-400">(optional)</span>}
              </span>
              <input
                className="input"
                placeholder="+233…"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              onClick={start}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700"
            >
              Start linking
            </button>
          </>
        )}

        {started && <LinkProgress method={method} status={status} />}
      </div>
    </div>
  );
}

function LinkProgress({ method, status }: { method: 'qr' | 'code'; status: Status | null }) {
  if (status?.status === 'connected') {
    return (
      <div className="py-6 text-center">
        <div className="text-4xl">✅</div>
        <p className="mt-3 font-semibold text-emerald-700">Connected!</p>
        <p className="text-sm text-slate-500">Taking you to your dashboard…</p>
      </div>
    );
  }

  if (method === 'qr') {
    return (
      <div className="py-2 text-center">
        {status?.qr ? (
          <div className="inline-block rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <QRCodeSVG value={status.qr} size={220} />
          </div>
        ) : (
          <p className="py-10 text-sm text-slate-500">Generating QR code…</p>
        )}
        <ol className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm text-slate-600">
          <li>1. Open WhatsApp on your phone.</li>
          <li>2. Settings → Linked Devices → Link a Device.</li>
          <li>3. Scan this code. It refreshes automatically.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="py-2 text-center">
      {status?.pairingCode ? (
        <div className="rounded-xl bg-emerald-50 py-6 ring-1 ring-emerald-100">
          <p className="text-sm text-slate-500">Enter this code in WhatsApp</p>
          <p className="mt-2 font-mono text-3xl font-bold tracking-widest text-emerald-700">{status.pairingCode}</p>
        </div>
      ) : (
        <p className="py-10 text-sm text-slate-500">Requesting pairing code…</p>
      )}
      <ol className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm text-slate-600">
        <li>1. Open WhatsApp → Linked Devices → Link a Device.</li>
        <li>2. Tap “Link with phone number instead”.</li>
        <li>3. Enter the code above.</li>
      </ol>
    </div>
  );
}

function MethodTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
        active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
