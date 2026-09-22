import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId } from '@/lib/auth';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ user: null }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      session: {
        select: { status: true, phoneNumber: true, linkMethod: true, lastConnectedAt: true },
      },
      watchlist: { orderBy: { createdAt: 'asc' } },
      channels: { orderBy: { createdAt: 'asc' } },
      alerts: { orderBy: { createdAt: 'desc' }, take: 12 },
    },
  });
  if (!user || !user.active) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, alertsPaused: user.alertsPaused },
    session: user.session ?? { status: 'disconnected', phoneNumber: null, linkMethod: 'qr', lastConnectedAt: null },
    watchlist: user.watchlist,
    channels: user.channels,
    alerts: user.alerts.map((a) => ({ id: a.id, kind: a.kind, who: a.who, channels: a.channels, createdAt: a.createdAt })),
  });
}
