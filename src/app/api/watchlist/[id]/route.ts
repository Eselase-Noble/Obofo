import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserId } from '@/lib/auth';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;
  // Scope the delete to the owner so users can only remove their own entries.
  await prisma.watchlistEntry.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
