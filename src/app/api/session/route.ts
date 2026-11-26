import { NextResponse } from 'next/server';
import { getSessionUser, SESSION_COOKIE } from '@/lib/session';

/** Who the session cookie says you are. 401 = sign in again. */
export async function GET() {
  const username = await getSessionUser();
  return username ? NextResponse.json({ username }) : NextResponse.json({ error: 'Not signed in' }, { status: 401 });
}

/** Sign out: clears the cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
