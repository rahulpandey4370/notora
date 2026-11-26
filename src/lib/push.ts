// Server-only (not a 'use server' file): imported by route handlers and actions.
// Adapted from ai-expense-tracker's src/lib/push.ts, but every send targets one
// user's devices: Notora has two accounts sharing one deploy.
import webpush from 'web-push';
import { getSupabase } from '@/lib/supabase';

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // page opened when the notification is tapped
  tag?: string; // same tag replaces an older notification instead of stacking
};

export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let configured = false;
function configure() {
  if (configured) return;
  if (!pushConfigured()) throw new Error('Push is not configured: set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

// The server POSTs to a subscription endpoint, so only accept real push
// services (Chrome/Android, Safari/iOS, Firefox, Edge): anything else is SSRF.
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'];
export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Sends to every device `username` enabled notifications on. Returns how many accepted it. */
export async function sendPush(username: string, payload: PushPayload): Promise<number> {
  configure();
  const supabase = getSupabase();
  const { data: subs, error } = await supabase
    .from('push_subscriptions').select('endpoint, p256dh, auth').eq('username', username);
  if (error) throw new Error(`Could not load push subscriptions: ${error.message}`);

  const results = await Promise.allSettled(
    (subs ?? []).filter(s => isPushEndpoint(s.endpoint)).map(s =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 12 },
      ),
    ),
  );

  // 404/410 = the device unsubscribed or the app was removed; forget it.
  const gone = results.flatMap((r, i) =>
    r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0) ? [subs![i].endpoint] : [],
  );
  if (gone.length) await supabase.from('push_subscriptions').delete().in('endpoint', gone);
  results.forEach((r, i) => {
    if (r.status === 'rejected' && !gone.includes(subs![i].endpoint)) console.error('Push send failed:', (r.reason as Error)?.message);
  });
  return results.filter(r => r.status === 'fulfilled').length;
}

/** Sends only the first time `key` is seen, so a retried cron run doesn't double-notify. */
export async function sendPushOnce(key: string, username: string, payload: PushPayload): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.from('notification_log').insert({ key });
  if (error) {
    if (error.code === '23505') return false;
    throw new Error(`Could not record notification: ${error.message}`);
  }
  try {
    if (await sendPush(username, payload)) return true;
  } catch (e) {
    await supabase.from('notification_log').delete().eq('key', key);
    throw e;
  }
  await supabase.from('notification_log').delete().eq('key', key); // no device got it: allow a retry
  return false;
}
