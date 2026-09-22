import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createAdminSession } from '@/lib/auth';

/** Admin platform sign-in. Only active admin accounts may authenticate here. */
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const cleanEmail = String(email ?? '').trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  const ok = user && (await verifyPassword(String(password ?? ''), user.passwordHash));

  // Same generic message whether the account is missing, wrong password, or not
  // an admin — never reveal which, to avoid probing for admin accounts.
  if (!ok || user.role !== 'admin' || !user.active) {
    return NextResponse.json({ error: 'Invalid credentials or not an admin account.' }, { status: 401 });
  }

  await createAdminSession(user.id);
  return NextResponse.json({ ok: true });
}
