// Server-only session helpers. Deliberately NOT a 'use server' file: exports
// here must never become client-callable endpoints.
//
// The session is an httpOnly cookie "<username>.<expiresMs>.<hmac>". Every
// server action and route that touches user data or spends AI credits calls
// requireUser(), so knowing a username is no longer enough to read or
// overwrite someone's data.
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'notora_session';
const MAX_AGE_S = 60 * 60 * 24 * 60; // 60 days

function secret(): string {
  // SESSION_SECRET if set; otherwise derived from the Supabase service key so
  // existing deploys work without a new env var. Rotating that key logs everyone out.
  const base = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is not configured.');
  return createHmac('sha256', 'notora-session-v1').update(base).digest('hex');
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function createSessionToken(username: string, now = Date.now()): string {
  const payload = `${encodeURIComponent(username.toLowerCase())}.${now + MAX_AGE_S * 1000}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the lower-cased username, or null if the token is missing, forged or expired. */
export function verifySessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [user, exp, mac] = parts;
  const expected = Buffer.from(sign(`${user}.${exp}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!(Number(exp) > now)) return null;
  return decodeURIComponent(user);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_S,
};

export async function getSessionUser(): Promise<string | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error('Your session has expired. Please sign in again.');
  return user;
}
