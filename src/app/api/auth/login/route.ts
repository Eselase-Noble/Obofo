import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const cleanEmail = String(email ?? '').trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user || !(await verifyPassword(String(password ?? ''), user.passwordHash))) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
