import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { normalizeNumber } from '@/lib/core/message-utils';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const watchlist = await prisma.watchlistEntry.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ watchlist });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { type, value, label } = await req.json().catch(() => ({}));
  const kind = ['number', 'group_name', 'group_jid'].includes(type) ? type : 'number';

  // Numbers are stored as bare digits; group names/JIDs as given.
  const cleanValue = kind === 'number' ? normalizeNumber(value) : String(value ?? '').trim();
  if (!cleanValue) return NextResponse.json({ error: 'Enter a value to watch.' }, { status: 400 });

  try {
    const entry = await prisma.watchlistEntry.create({
      data: { userId, type: kind, value: cleanValue, label: label ? String(label).trim() : null },
    });
    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: 'That contact is already on your watchlist.' }, { status: 409 });
  }
}
