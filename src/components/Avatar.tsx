/** Initials avatar. Deterministic tint from the name so people stay recognisable. */
export default function Avatar({ name, email, size = 36 }: { name?: string | null; email?: string; size?: number }) {
  const label = (name || email || '?').trim();
  const initials = label
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const tints = [
    'bg-brand-100 text-brand-700',
    'bg-emerald-100 text-emerald-700',
    'bg-signal-100 text-signal-700',
    'bg-clay-50 text-clay-700',
  ];
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  const tint = tints[hash % tints.length];

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${tint}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
