'use server';

import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/supabase';
import { requireUser } from '@/lib/session';

/**
 * Progress photos in a PRIVATE Supabase Storage bucket. Paths are always built
 * here from the session user ("<user>/<uuid>.jpg"), and only paths under your
 * own folder are ever signed or deleted, so one user can never see another's.
 * Viewing uses signed URLs that expire after 10 minutes.
 */
const BUCKET = 'notora-progress';
const folder = (username: string) => username.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
const MAX_BYTES = 900_000; // the page downscales to ~1280px JPEG first; server actions take 1 MB

async function ensureBucket() {
  const storage = getSupabase().storage;
  const { error } = await storage.getBucket(BUCKET);
  if (!error) return;
  const made = await storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
  if (made.error && !/already exists/i.test(made.error.message)) throw new Error(`Couldn't set up photo storage: ${made.error.message}`);
}

export async function uploadProgressPhoto(dataUrl: string): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const username = await requireUser();
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { ok: false, error: 'That isn’t a JPEG, PNG or WebP image.' };
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_BYTES) return { ok: false, error: 'That photo is too large.' };
  try { await ensureBucket(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const path = `${folder(username)}/${uuidv4()}.${m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg'}`;
  const { error } = await getSupabase().storage.from(BUCKET).upload(path, bytes, { contentType: m[1], upsert: false });
  return error ? { ok: false, error: error.message } : { ok: true, path };
}

/** Short-lived links for your own photos; anything outside your folder is ignored. */
export async function progressPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  const username = await requireUser();
  const own = [...new Set(paths)].filter(p => p.startsWith(`${folder(username)}/`) && !p.includes('..')).slice(0, 60);
  if (!own.length) return {};
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(own, 600);
  if (error || !data) return {};
  return Object.fromEntries(data.flatMap(d => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
}

export async function deleteProgressPhoto(path: string): Promise<{ ok: boolean }> {
  const username = await requireUser();
  if (!path.startsWith(`${folder(username)}/`) || path.includes('..')) return { ok: false };
  const { error } = await getSupabase().storage.from(BUCKET).remove([path]);
  return { ok: !error };
}
