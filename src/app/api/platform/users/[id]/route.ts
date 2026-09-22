import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPlatformAdmin } from '@/lib/auth';

/** Enable/disable an account or change its role. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 401 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: 'You can’t change your own role or status.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { active?: boolean; role?: string } = {};
  if (typeof body.active === 'boolean') data.active = body.active;
  if (body.role === 'admin' || body.role === 'user') data.role = body.role;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  await prisma.user.update({ where: { id }, data });

  // Disabling a user should also tear down their WhatsApp session on the next
  // worker tick — reconcile() stops sockets for inactive users.
  if (data.active === false) {
    await prisma.waSession.updateMany({
      where: { userId: id },
      data: { status: 'disconnected', linkRequested: false, qr: null, pairingCode: null },
    });
  }

  return NextResponse.json({ ok: true, ...data });
}

/** Permanently delete a user and everything cascaded to them. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 401 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: 'You can’t delete your own account here.' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
