import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId } from '@/lib/auth';

/** Unlink WhatsApp: clear credentials so the worker's reconcile stops the socket. */
export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  await prisma.waSession.updateMany({
    where: { userId },
    data: { status: 'disconnected', linkRequested: false, qr: null, pairingCode: null, creds: undefined, keys: undefined },
  });

  return NextResponse.json({ ok: true });
}
