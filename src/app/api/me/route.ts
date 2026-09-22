import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId } from '@/lib/auth';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ user: null }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      session: { select: { status: true, phoneNumber: true, linkMethod: true } },
      watchlist: { orderBy: { createdAt: 'asc' } },
      channels: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    session: user.session ?? { status: 'disconnected', phoneNumber: null, linkMethod: 'qr' },
    watchlist: user.watchlist,
    channels: user.channels,
  });
}
