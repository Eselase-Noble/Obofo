import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { normalizeNumber } from '@/lib/core/message-utils';

/** Start (or restart) linking this user's WhatsApp. The worker picks up `linkRequested`. */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { method, phoneNumber } = await req.json().catch(() => ({}));
  const linkMethod = method === 'code' ? 'code' : 'qr';
  const phone = normalizeNumber(phoneNumber);

  if (linkMethod === 'code' && !phone) {
    return NextResponse.json({ error: 'A phone number is required for code linking.' }, { status: 400 });
  }

  await prisma.waSession.upsert({
    where: { userId },
    create: { userId, phoneNumber: phone || null, linkMethod, linkRequested: true, status: 'linking' },
    // A fresh link request wipes any previous credentials so pairing starts clean.
    update: {
      phoneNumber: phone || null,
      linkMethod,
      linkRequested: true,
      status: 'linking',
      qr: null,
      pairingCode: null,
      creds: undefined,
      keys: undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
