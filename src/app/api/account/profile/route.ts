import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId, verifyPassword } from '@/lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * An app user edits their own profile. Name changes freely; changing the
 * sign-in email requires the current password (it's an identity change) and
 * must stay unique across accounts.
 */
export async function PATCH(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { name, email, currentPassword } = await req.json().catch(() => ({}));

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  const data: { name?: string | null; email?: string } = {};

  // Name — optional, trimmed; an empty name clears it.
  if (name !== undefined) {
    const clean = String(name).trim();
    if (clean.length > 80) return NextResponse.json({ error: 'Name is too long.' }, { status: 400 });
    data.name = clean || null;
  }

  // Email — only when it actually changes, and only with the right password.
  if (email !== undefined) {
    const clean = String(email).trim().toLowerCase();
    if (clean !== user.email) {
      if (!EMAIL_RE.test(clean)) {
        return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
      }
      if (!(await verifyPassword(String(currentPassword ?? ''), user.passwordHash))) {
        return NextResponse.json({ error: 'Enter your current password to change your email.' }, { status: 400 });
      }
      const taken = await prisma.user.findUnique({ where: { email: clean }, select: { id: true } });
      if (taken && taken.id !== userId) {
        return NextResponse.json({ error: 'That email is already in use.' }, { status: 409 });
      }
      data.email = clean;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, name: user.name, email: user.email });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { name: true, email: true },
  });
  return NextResponse.json({ ok: true, ...updated });
}
