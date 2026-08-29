import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './db';

export const SESSION_COOKIE = 'gg_session';
const SESSION_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  displayName: string;
  role: 'owner' | 'stock';
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== 'string' || typeof payload.displayName !== 'string') return null;
    if (payload.role !== 'owner' && payload.role !== 'stock') return null;
    return { userId: payload.userId, displayName: payload.displayName, role: payload.role };
  } catch {
    return null;
  }
}

/** Read + verify the session from the request cookie jar (Server Components / Route Handlers). */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export type LoginResult =
  | { ok: true; payload: SessionPayload }
  | { ok: false; error: string };

/**
 * Validate name + PIN against the User table, with lockout after
 * MAX_FAILED_ATTEMPTS consecutive failures (production requirement from the
 * design README — the prototype only had the demo PIN check).
 */
export async function attemptLogin(displayName: string, pin: string): Promise<LoginResult> {
  const user = await prisma.user.findFirst({ where: { displayName, active: true } });
  if (!user) return { ok: false, error: 'เลือกชื่อก่อนนะ' };

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `ล็อกอินผิดหลายครั้งเกินไป ลองใหม่อีก ${minutesLeft} นาที` };
  }

  const valid = await verifyPin(pin.trim(), user.pinHash);
  if (!valid) {
    const failedAttempts = user.failedAttempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: lockedUntil ? 0 : failedAttempts, lockedUntil },
    });
    return {
      ok: false,
      error: lockedUntil ? `ล็อกอินผิดครบ ${MAX_FAILED_ATTEMPTS} ครั้ง — ล็อก ${LOCKOUT_MINUTES} นาที` : 'PIN ไม่ตรง ลองอีกที',
    };
  }

  if (user.failedAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
  }

  return { ok: true, payload: { userId: user.id, displayName: user.displayName, role: user.role } };
}
