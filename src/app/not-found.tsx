import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex w-fit items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="#fff" strokeWidth="1.9">
              <path d="M5 9v6M5 11l11-5v12L5 13M16 8.5a3.5 3.5 0 0 1 0 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">Ɔbɔfo</span>
        </div>

        <p className="font-display text-6xl font-semibold tracking-tight text-brand-600">404</p>
        <h1 className="mt-3 font-display text-xl font-semibold tracking-tight text-ink">This page isn’t here</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink/55">
          The link may be broken, or the page may have moved. Nothing was lost — your alerts are still running.
        </p>

        <div className="mt-7 flex items-center justify-center gap-2.5">
          <Link href="/" className="btn-primary">
            Back to dashboard
          </Link>
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
