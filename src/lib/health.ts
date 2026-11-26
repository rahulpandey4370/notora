// Server-only Google Health API client (the successor to the Fitbit Web API).
// Not a 'use server' file. Docs: developers.google.com/health
//
// Flow: Fitbit band -> Google Health app on the phone -> Google's servers ->
// this module (OAuth refresh token stored in notora.health_connections) ->
// notora.health_daily -> merged into log trackers on load.
import { getSupabase } from '@/lib/supabase';
import { combineDays, parseRestingHr, parseSleep, parseStepsRollup, type HealthDay } from '@/lib/health-merge';

const API = 'https://health.googleapis.com/v4/users/me';
export const HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
];

export const healthConfigured = () => !!(process.env.GOOGLE_HEALTH_CLIENT_ID && process.env.GOOGLE_HEALTH_CLIENT_SECRET);

/** Thrown when Google no longer accepts the refresh token (7 days in "Testing" mode, or revoked). */
export class ReconnectNeeded extends Error {}

export function authorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: HEALTH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // always issue a fresh refresh token on (re)connect
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET!,
      ...params,
    }),
  });
  const json = await res.json().catch(() => ({}));
  // Only the error code/description are surfaced, never token material.
  if (!res.ok) return { ok: false as const, error: String(json.error ?? res.status), description: String(json.error_description ?? '') };
  return { ok: true as const, json };
}

/** Exchanges the OAuth code and stores the connection. Returns an error message, or null on success. */
export async function connectWithCode(username: string, code: string, redirectUri: string): Promise<string | null> {
  const r = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  if (!r.ok) return `Google rejected the sign-in (${r.error}).`;
  const { access_token, refresh_token, expires_in } = r.json;
  if (!refresh_token) return 'Google did not return a refresh token. Remove Notora at myaccount.google.com/permissions and connect again.';

  // The account must have a Google Health profile (Fitbit migrated) before data is readable.
  const id = await fetch(`${API}/identity`, { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } });
  if (!id.ok) {
    const body = await id.text();
    return body.includes('ACCOUNT_NOT_LINKED')
      ? 'This Google account has no Google Health profile yet. Sign in to the Google Health (Fitbit) app with it first, then connect again.'
      : `Google Health identity check failed (${id.status}).`;
  }

  const { error } = await getSupabase().from('health_connections').upsert({
    username,
    refresh_token,
    access_token,
    access_expires_at: new Date(Date.now() + (Number(expires_in) - 60) * 1000).toISOString(),
    status: 'connected',
    last_error: null,
    connected_at: new Date().toISOString(),
  });
  return error ? `Could not save the connection: ${error.message}` : null;
}

async function accessToken(username: string): Promise<string> {
  const supabase = getSupabase();
  const { data: c, error } = await supabase.from('health_connections').select('*').eq('username', username).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c || c.status !== 'connected') throw new ReconnectNeeded('Fitbit is not connected.');
  if (c.access_token && Date.parse(c.access_expires_at) > Date.now()) return c.access_token;

  const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: c.refresh_token });
  if (!r.ok) {
    if (r.error === 'invalid_grant') {
      await supabase.from('health_connections')
        .update({ status: 'reconnect', access_token: null, last_error: 'Google ended the connection. Reconnect Fitbit.' })
        .eq('username', username);
      throw new ReconnectNeeded('Google ended the Fitbit connection. Reconnect it from the Logs page.');
    }
    throw new Error(`Token refresh failed (${r.error}).`);
  }
  await supabase.from('health_connections').update({
    access_token: r.json.access_token,
    access_expires_at: new Date(Date.now() + (Number(r.json.expires_in) - 60) * 1000).toISOString(),
    ...(r.json.refresh_token ? { refresh_token: r.json.refresh_token } : {}),
  }).eq('username', username);
  return r.json.access_token;
}

async function api(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`${path.split('?')[0]} → ${res.status}: ${body}`);
  }
  return res.json();
}

const ymdParts = (ymd: string) => {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
};

/**
 * Pulls the last `days` days and upserts them into notora.health_daily.
 * Each metric is fetched independently so one failing type (e.g. no resting
 * HR yet) doesn't block the others; their errors are reported together.
 */
export async function syncHealth(username: string, days = 7): Promise<{ days: number; errors: string[] }> {
  const token = await accessToken(username);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const startYmd = start.toISOString().slice(0, 10);
  const endYmd = new Date(end.getTime() + 86400_000).toISOString().slice(0, 10); // exclusive end, covers today in any tz

  const errors: string[] = [];
  const attempt = async (f: () => Promise<HealthDay[]>) => {
    try { return await f(); } catch (e: any) { errors.push(e.message); return []; }
  };

  const [steps, sleep, rhr] = await Promise.all([
    attempt(async () => parseStepsRollup(await api(token, '/dataTypes/steps/dataPoints:dailyRollUp', {
      method: 'POST',
      body: JSON.stringify({
        range: { start: { date: ymdParts(startYmd), time: { hours: 0 } }, end: { date: ymdParts(endYmd), time: { hours: 0 } } },
        windowSizeDays: 1,
      }),
    }))),
    attempt(async () => {
      // Sleep pages hold at most 25 sessions; a 30-day backfill needs several.
      const filter = encodeURIComponent(`sleep.interval.civil_end_time >= "${startYmd}T00:00:00"`);
      const all: unknown[] = [];
      let pageToken = '';
      for (let i = 0; i < 10; i++) {
        const page = await api(token, `/dataTypes/sleep/dataPoints?pageSize=25&filter=${filter}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
        all.push(...(page.dataPoints ?? []));
        pageToken = page.nextPageToken;
        if (!pageToken) break;
      }
      return parseSleep({ dataPoints: all });
    }),
    attempt(async () => parseRestingHr(await api(token,
      `/dataTypes/daily-resting-heart-rate/dataPoints?filter=${encodeURIComponent(`daily_resting_heart_rate.date >= "${startYmd}"`)}`))),
  ]);

  const rows = combineDays(steps, sleep, rhr).map(d => ({ ...d, username, updated_at: new Date().toISOString() }));
  const supabase = getSupabase();
  if (rows.length) {
    const { error } = await supabase.from('health_daily').upsert(rows, { onConflict: 'username,date' });
    if (error) errors.push(`Saving: ${error.message}`);
  }
  await supabase.from('health_connections')
    .update({ last_sync_at: new Date().toISOString(), last_error: errors.length ? errors.join(' | ').slice(0, 500) : null })
    .eq('username', username);
  return { days: rows.length, errors };
}

/** Recent synced days for merging into trackers. Empty if the table isn't set up yet. */
export async function recentHealthDays(username: string, days = 60): Promise<HealthDay[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await getSupabase()
    .from('health_daily').select('date, steps, sleep_minutes, resting_hr').eq('username', username).gte('date', since);
  if (error) return []; // e.g. migration not run yet: health is optional
  return data ?? [];
}
