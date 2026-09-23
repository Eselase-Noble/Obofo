import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId, verifyPassword, hashPassword } from '@/lib/auth';

/** An app user changes their own password (requires the current one). */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (String(newPassword ?? '').length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (!(await verifyPassword(String(currentPassword ?? ''), user.passwordHash))) {
    return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(String(newPassword)) } });
  return NextResponse.json({ ok: true });
}
