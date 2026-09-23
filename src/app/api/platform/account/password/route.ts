import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPlatformAdmin, verifyPassword, hashPassword } from '@/lib/auth';

/** A platform admin changes their own password (requires the current one). */
export async function POST(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (String(newPassword ?? '').length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: admin.id } });
  if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (!(await verifyPassword(String(currentPassword ?? ''), user.passwordHash))) {
    return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(String(newPassword)) } });
  return NextResponse.json({ ok: true });
}
