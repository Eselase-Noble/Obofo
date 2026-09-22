import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPlatformAdmin, hashPassword } from '@/lib/auth';

/**
 * Create a new team member (platform admin). Team members are provisioned here
 * by an existing admin — they are a separate population from app users, who
 * sign themselves up. An email already in use (by anyone) is rejected rather
 * than promoted, so the two populations never blur.
 */
export async function POST(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 401 });

  const { name, email, password } = await req.json().catch(() => ({}));
  const cleanEmail = String(email ?? '').trim().toLowerCase();

  if (!cleanEmail.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (String(password ?? '').length < 6) {
    return NextResponse.json({ error: 'Set a password of at least 6 characters.' }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email: cleanEmail } })) {
    return NextResponse.json({ error: 'That email is already in use.' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email: cleanEmail,
      name: name ? String(name).trim() : null,
      role: 'admin',
      active: true,
      passwordHash: await hashPassword(String(password)),
    },
  });

  return NextResponse.json({ ok: true, id: user.id });
}
