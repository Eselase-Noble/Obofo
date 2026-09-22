import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId } from '@/lib/auth';

/** Polled by the Link page to show QR / pairing code / connection status. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const session = await prisma.waSession.findUnique({
    where: { userId },
    select: { status: true, qr: true, pairingCode: true, linkMethod: true, phoneNumber: true },
  });

  return NextResponse.json(
    session ?? { status: 'disconnected', qr: null, pairingCode: null, linkMethod: 'qr', phoneNumber: null },
  );
}
