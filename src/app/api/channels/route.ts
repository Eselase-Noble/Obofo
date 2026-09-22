import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { normalizeNumber } from '@/lib/core/message-utils';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const channels = await prisma.alertChannel.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ channels });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { type, destination } = await req.json().catch(() => ({}));
  const kind = type === 'sms' ? 'sms' : 'email';

  let dest = String(destination ?? '').trim();
  if (kind === 'email' && !dest.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (kind === 'sms') {
    const digits = normalizeNumber(dest);
    if (!digits) return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 });
    dest = digits;
  }

  const channel = await prisma.alertChannel.create({ data: { userId, type: kind, destination: dest } });
  return NextResponse.json({ channel });
}
