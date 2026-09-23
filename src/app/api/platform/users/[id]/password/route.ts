import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPlatformAdmin, hashPassword } from '@/lib/auth';

/**
 * An admin resets another account's password. No current password needed — this
 * is the "they forgot / needs a reset" path. The admin then shares the new one.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 401 });

  const { id } = await params;
  const { password } = await req.json().catch(() => ({}));
  if (String(password ?? '').length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(String(password)) } });
  return NextResponse.json({ ok: true });
}
