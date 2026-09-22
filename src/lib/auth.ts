import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './db';

const COOKIE = 'obofo_session';
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-only-insecure-secret');

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

/** Issue a signed session cookie for the user. */
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user's id, or null. */
export async function getUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.uid as string) ?? null;
  } catch {
    return null;
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
}

/**
 * The signed-in user, loaded fresh from the database, or null. Returns null for
 * disabled accounts so a revoked user is treated exactly like a signed-out one.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const uid = await getUserId();
  if (!uid) return null;
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
}

/** The signed-in user if (and only if) they're an active admin, else null. */
export async function getAdmin(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user && user.role === 'admin' ? user : null;
}
