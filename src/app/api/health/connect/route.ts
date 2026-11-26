import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSessionUser } from '@/lib/session';
import { authorizeUrl, healthConfigured } from '@/lib/health';

const STATE_COOKIE = 'notora_health_state';

/** Starts "Connect Fitbit": sends you to Google's consent screen. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!(await getSessionUser())) return NextResponse.redirect(`${origin}/login`);
  if (!healthConfigured()) return NextResponse.redirect(`${origin}/logs?health=not_configured`);
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(authorizeUrl(`${origin}/api/health/callback`, state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/health', maxAge: 600 });
  return res;
}
