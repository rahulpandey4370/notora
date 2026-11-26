'use server';

import { getSupabase } from '@/lib/supabase';
import { requireUser } from '@/lib/session';
import type { AppData } from '@/lib/types';
import { recentHealthDays } from '@/lib/health';
import { mergeHealthIntoTrackers } from '@/lib/health-merge';

/**
 * Whole-document storage, one row per user in notora.app_data.
 *
 * The user always comes from the session cookie, never from the caller: these
 * are public server actions, so a username argument would let anyone read or
 * overwrite anyone's data.
 *
 * `version` is the row's updated_at. Saves are conditional on it, so a stale
 * device (phone left open since yesterday) can't silently overwrite newer
 * edits made elsewhere; it gets `conflict` and reloads instead.
 */
export type Stored = { data: AppData; version: string };
export type SaveResult = { ok: true; version: string } | { ok: false; conflict: true };

/** null = this user has no row yet. Throws on any other failure (never treat an outage as "new user"). */
export async function getAppData(): Promise<Stored | null> {
  const username = await requireUser();
  const { data, error } = await getSupabase()
    .from('app_data')
    .select('data, updated_at')
    .eq('username', username)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load your data: ${error.message}`);
  if (!data) return null;
  // Fitbit days live in their own table (so a background sync never conflicts
  // with an open device) and are folded into the log trackers here.
  const merged = mergeHealthIntoTrackers(data.data as AppData, await recentHealthDays(username));
  return { data: merged, version: data.updated_at };
}

/** First save for a new user. If a row appeared meanwhile, returns that instead of overwriting it. */
export async function createAppData(initial: AppData): Promise<Stored> {
  const username = await requireUser();
  const { data, error } = await getSupabase()
    .from('app_data')
    .insert({ username, data: stripHistory(initial), updated_at: new Date().toISOString() })
    .select('updated_at')
    .single();
  if (error) {
    if (error.code === '23505') {
      const existing = await getAppData();
      if (existing) return existing;
    }
    throw new Error(`Couldn't create your workspace: ${error.message}`);
  }
  return { data: initial, version: data.updated_at };
}

export async function saveAppData(next: AppData, baseVersion: string): Promise<SaveResult> {
  const username = await requireUser();
  const { data, error } = await getSupabase()
    .from('app_data')
    .update({ data: stripHistory(next), updated_at: new Date().toISOString() })
    .eq('username', username)
    .eq('updated_at', baseVersion)
    .select('updated_at');
  if (error) throw new Error(error.message);
  if (!data?.length) return { ok: false, conflict: true };
  return { ok: true, version: data[0].updated_at };
}

/**
 * Per-note undo/redo history only matters while the app is open (the loader
 * rebuilds it), but it was being saved with every note and grew the document
 * on every keystroke-commit.
 */
function stripHistory(d: AppData): AppData {
  return {
    ...d,
    noteBoards: (d.noteBoards ?? []).map(b => ({
      ...b,
      notes: (b.notes ?? []).map(({ history, ...n }) => n),
    })),
  };
}
