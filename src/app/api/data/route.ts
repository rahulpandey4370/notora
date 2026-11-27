import { NextResponse } from 'next/server';
import { createAppData, getAppData, saveAppData } from '@/lib/storage';
import type { AppData } from '@/lib/types';

/**
 * The workspace load/save, as a route instead of server actions: Next runs
 * server actions one at a time per tab, so a slow AI call used to hold up
 * every load and save behind it. POST only (the service worker caches GET
 * /api/* and could serve a stale document). Same functions as before, so the
 * version check (no overwriting newer edits) is unchanged. The user comes from
 * the session cookie (SameSite=Lax, so other sites can't post with it).
 */
export const dynamic = 'force-dynamic';

type Body = { op: 'load' } | { op: 'create'; data: AppData } | { op: 'save'; data: AppData; version: string };

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const t0 = Date.now();
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  try {
    const result = body.op === 'load' ? await getAppData()
      : body.op === 'create' ? await createAppData(body.data)
        : body.op === 'save' && typeof body.version === 'string' ? await saveAppData(body.data, body.version)
          : undefined;
    if (result === undefined) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    return NextResponse.json({ result }, { headers: { 'Cache-Control': 'no-store', 'Server-Timing': `db;dur=${Date.now() - t0}` } });
  } catch (e) {
    const message = (e as Error).message || 'Failed';
    return NextResponse.json({ error: message }, { status: /session has expired/i.test(message) ? 401 : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
