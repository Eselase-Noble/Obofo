import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './db';

// Two fully independent sessions so the admin platform and the user app never
// share a login: signing into one grants nothing on the other.
const USER_COOKIE = 'obofo_session';
const ADMIN_COOKIE = 'obofo_platform';
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-only-insecure-secret');

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

async function issue(cookieName: string, userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);

  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function readUid(cookieName: string): Promise<string | null> {
  const token = (await cookies()).get(cookieName)?.value;
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

async function loadActiveUser(uid: string | null): Promise<SessionUser | null> {
  if (!uid) return null;
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
}

/* ------------------------------- user side ------------------------------- */

/** Issue the user-app session cookie. */
export function createSession(userId: string): Promise<void> {
  return issue(USER_COOKIE, userId);
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(USER_COOKIE);
}

/** The signed-in user's id (user app), or null. */
export function getUserId(): Promise<string | null> {
  return readUid(USER_COOKIE);
}

/**
 * The signed-in user, loaded fresh from the database, or null. Returns null for
 * disabled accounts so a revoked user is treated exactly like a signed-out one.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return loadActiveUser(await getUserId());
}

/* ----------------------------- platform side ----------------------------- */

/** Issue the admin platform session cookie (separate from the user cookie). */
export function createAdminSession(userId: string): Promise<void> {
  return issue(ADMIN_COOKIE, userId);
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

/**
 * The signed-in platform admin, or null. Requires a valid admin cookie AND that
 * the account is still an active admin — demotion or disabling revokes access.
 */
export async function getPlatformAdmin(): Promise<SessionUser | null> {
  const user = await loadActiveUser(await readUid(ADMIN_COOKIE));
  return user && user.role === 'admin' ? user : null;
}
