'use client';

import { useState } from 'react';

export const PER_PAGE_OPTIONS = [10, 25, 50];

export interface Paged<T> {
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
  from: number; // 1-based index of first item on page (0 when empty)
  to: number; // 1-based index of last item on page
  pageItems: T[];
  setPage: (p: number) => void;
  setPerPage: (n: number) => void;
}

/**
 * Client-side pagination over an already-filtered array. Page is clamped during
 * render (not via an effect) so shrinking the list never strands you on an empty
 * page. Pass a `resetKey` that changes whenever filters change to jump back to
 * page 1.
 */
export function usePagination<T>(items: T[], initialPerPage = 10, resetKey = ''): Paged<T> {
  const [perPage, setPerPageRaw] = useState(initialPerPage);
  const [page, setPage] = useState(1);
  const [seenKey, setSeenKey] = useState(resetKey);

  // Filters changed → snap to the first page. Done in render (cheap, idempotent).
  if (resetKey !== seenKey) {
    setSeenKey(resetKey);
    if (page !== 1) setPage(1);
  }

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * perPage;
  const pageItems = items.slice(start, start + perPage);

  return {
    page: safePage,
    perPage,
    total,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + perPage, total),
    pageItems,
    setPage,
    setPerPage: (n: number) => {
      setPerPageRaw(n);
      setPage(1);
    },
  };
}

/** Range of page numbers to show, with -1 marking a gap (…). */
function pageWindow(page: number, pageCount: number): number[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: number[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pageCount - 1, page + 1);
  if (lo > 2) out.push(-1);
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pageCount - 1) out.push(-1);
  out.push(pageCount);
  return out;
}

export function Pagination<T>({ paged, noun = 'items' }: { paged: Paged<T>; noun?: string }) {
  const { page, perPage, total, pageCount, from, to, setPage, setPerPage } = paged;

  return (
    <div className="flex flex-col gap-3 border-t border-line px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4 text-sm text-ink/55">
        <span>
          {total === 0 ? `No ${noun}` : (
            <>
              <span className="font-medium text-ink">{from}–{to}</span> of{' '}
              <span className="font-medium text-ink">{total}</span> {noun}
            </>
          )}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="hidden sm:inline">Rows</span>
          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className="rounded-md border border-line bg-white px-1.5 py-1 text-sm text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/15"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <PagerButton disabled={page <= 1} onClick={() => setPage(page - 1)} label="Previous page">
            ‹
          </PagerButton>
          {pageWindow(page, pageCount).map((p, i) =>
            p === -1 ? (
              <span key={`gap-${i}`} className="px-1 text-ink/35">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`min-w-8 rounded-md px-2 py-1 text-sm font-medium transition ${
                  p === page ? 'bg-pine-600 text-white' : 'text-ink/60 hover:bg-paper hover:text-ink'
                }`}
              >
                {p}
              </button>
            ),
          )}
          <PagerButton disabled={page >= pageCount} onClick={() => setPage(page + 1)} label="Next page">
            ›
          </PagerButton>
        </div>
      )}
    </div>
  );
}

function PagerButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-ink/60 transition hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
