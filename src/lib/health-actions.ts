'use server';

import { getSupabase } from '@/lib/supabase';
import { requireUser } from '@/lib/session';
import { healthConfigured, ReconnectNeeded, syncHealth } from '@/lib/health';

export type HealthStatus =
  | { state: 'unavailable' }                       // env vars or tables not set up
  | { state: 'disconnected' }
  | { state: 'reconnect'; message: string }        // Google ended the connection
  | { state: 'connected'; lastSyncAt: string | null; lastError: string | null };

export async function getHealthStatus(): Promise<HealthStatus> {
  const username = await requireUser();
  if (!healthConfigured()) return { state: 'unavailable' };
  const { data, error } = await getSupabase()
    .from('health_connections').select('status, last_sync_at, last_error').eq('username', username).maybeSingle();
  if (error) return { state: 'unavailable' };
  if (!data) return { state: 'disconnected' };
  if (data.status === 'reconnect') return { state: 'reconnect', message: data.last_error ?? 'Reconnect Fitbit.' };
  return { state: 'connected', lastSyncAt: data.last_sync_at, lastError: data.last_error };
}

export async function syncHealthNow(): Promise<{ ok: boolean; message: string }> {
  const username = await requireUser();
  try {
    const { days, errors } = await syncHealth(username, 30);
    if (errors.length) return { ok: false, message: `Synced ${days} days with problems: ${errors.join(' | ').slice(0, 300)}` };
    return { ok: true, message: `Synced ${days} day${days === 1 ? '' : 's'} from Fitbit.` };
  } catch (e: any) {
    return { ok: false, message: e instanceof ReconnectNeeded ? e.message : `Sync failed: ${e.message}` };
  }
}

/** Forgets the tokens. Synced history stays in your trackers. */
export async function disconnectHealth(): Promise<void> {
  const username = await requireUser();
  await getSupabase().from('health_connections').delete().eq('username', username);
}
