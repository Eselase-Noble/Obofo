import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId } from '@/lib/auth';

/** Update the signed-in user's own preferences. Currently: pause/resume alerts. */
export async function PATCH(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { alertsPaused?: boolean } = {};
  if (typeof body.alertsPaused === 'boolean') data.alertsPaused = body.alertsPaused;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.json({ ok: true, ...data });
}
