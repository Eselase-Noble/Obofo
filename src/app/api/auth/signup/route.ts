import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password, name } = await req.json().catch(() => ({}));
  const cleanEmail = String(email ?? '').trim().toLowerCase();

  if (!cleanEmail.includes('@') || String(password ?? '').length < 6) {
    return NextResponse.json({ error: 'Enter a valid email and a password of at least 6 characters.' }, { status: 400 });
  }

  if (await prisma.user.findUnique({ where: { email: cleanEmail } })) {
    return NextResponse.json({ error: 'That email is already registered.' }, { status: 409 });
  }

  // Public signups are always regular users. Admins are provisioned separately
  // via the platform (see `npm run create-admin`), never through this form.
  const user = await prisma.user.create({
    data: {
      email: cleanEmail,
      name: name ? String(name).trim() : null,
      passwordHash: await hashPassword(String(password)),
    },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
