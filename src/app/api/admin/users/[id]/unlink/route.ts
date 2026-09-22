import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdmin } from '@/lib/auth';

/** Force a user's WhatsApp to unlink — clears creds so reconcile() stops the socket. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const { id } = await params;
  await prisma.waSession.updateMany({
    where: { userId: id },
    data: {
      status: 'disconnected',
      linkRequested: false,
      qr: null,
      pairingCode: null,
      creds: undefined,
      keys: undefined,
      lastConnectedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
