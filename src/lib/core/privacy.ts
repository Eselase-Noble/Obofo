/**
 * Masking helpers for the admin surface. Admins manage the system, but they
 * should never need to read a user's full personal identifiers, so we show
 * enough to recognise a record and redact the rest.
 */

/** ama.owusu@gmail.com -> am••••@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••';
  const head = local.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

/** 233553851758 -> +233 •• •• 1758 (keeps country hint + last 4) */
export function maskPhone(digits: string | null | undefined): string | null {
  if (!digits) return null;
  const d = digits.replace(/\D/g, '');
  if (d.length < 5) return '••••';
  const cc = d.slice(0, 3);
  const last = d.slice(-4);
  return `+${cc} •• •• ${last}`;
}

/** you@example.com or a phone, masked for its type. */
export function maskDestination(type: string, destination: string): string {
  return type === 'email' ? maskEmail(destination) : maskPhone(destination) ?? '••••';
}
