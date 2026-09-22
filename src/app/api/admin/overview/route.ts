import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { maskEmail, maskPhone } from '@/lib/core/privacy';
import { deviceRisk } from '@/lib/core/device';

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const now = new Date();
  const since24h = new Date(now.getTime() - 86_400_000);

  const [users, alertsTotal, alerts24h] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        alertsPaused: true,
        createdAt: true,
        session: { select: { status: true, phoneNumber: true, lastConnectedAt: true } },
        _count: { select: { watchlist: true, channels: true, alerts: true } },
      },
    }),
    prisma.alertLog.count(),
    prisma.alertLog.count({ where: { createdAt: { gte: since24h } } }),
  ]);

  const rows = users.map((u) => {
    const status = u.session?.status ?? 'disconnected';
    const risk = deviceRisk(status, u.session?.lastConnectedAt ?? null, now);
    return {
      id: u.id,
      name: u.name,
      email: maskEmail(u.email),
      role: u.role,
      active: u.active,
      alertsPaused: u.alertsPaused,
      createdAt: u.createdAt,
      status,
      phone: maskPhone(u.session?.phoneNumber),
      lastConnectedAt: u.session?.lastConnectedAt ?? null,
      risk: risk.level,
      daysLeft: risk.daysLeft,
      counts: { watchlist: u._count.watchlist, channels: u._count.channels, alerts: u._count.alerts },
    };
  });

  const totals = {
    users: rows.length,
    active: rows.filter((r) => r.active).length,
    disabled: rows.filter((r) => !r.active).length,
    admins: rows.filter((r) => r.role === 'admin').length,
    connected: rows.filter((r) => r.status === 'connected').length,
    loggedOut: rows.filter((r) => r.status === 'logged_out').length,
    unlinked: rows.filter((r) => r.status === 'disconnected' || r.status === 'linking').length,
    atRisk: rows.filter((r) => r.risk === 'warn' || r.risk === 'expired').length,
    paused: rows.filter((r) => r.alertsPaused).length,
    alertsTotal,
    alerts24h,
  };

  return NextResponse.json({ me: { id: admin.id }, totals, users: rows });
}
