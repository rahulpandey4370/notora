import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/session';
import { connectWithCode, syncHealth } from '@/lib/health';

/** Google redirects here after consent. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string, message?: string) =>
    NextResponse.redirect(`${url.origin}/logs?health=${status}${message ? `&message=${encodeURIComponent(message)}` : ''}`);

  const username = await getSessionUser();
  if (!username) return NextResponse.redirect(`${url.origin}/login`);
  const expected = (await cookies()).get('notora_health_state')?.value;
  if (!expected || url.searchParams.get('state') !== expected) return back('error', 'The sign-in link expired. Try connecting again.');
  if (url.searchParams.get('error')) return back('error', 'Google sign-in was cancelled.');
  const code = url.searchParams.get('code');
  if (!code) return back('error', 'Google did not return a code.');

  const problem = await connectWithCode(username, code, `${url.origin}/api/health/callback`);
  if (problem) return back('error', problem);
  // Backfill a month so the trackers aren't empty on day one.
  const { errors } = await syncHealth(username, 30).catch((e: Error) => ({ errors: [e.message] }));
  const res = back('connected', errors.length ? `Connected, but some data didn't sync: ${errors[0]}` : undefined);
  res.cookies.delete('notora_health_state');
  return res;
}
