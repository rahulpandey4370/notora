'use server';

import { getSupabase } from '@/lib/supabase';
import { requireUser } from '@/lib/session';
import { isPushEndpoint, sendPush } from '@/lib/push';

type SubJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function savePushSubscription(sub: SubJSON, userAgent: string, replacesEndpoint?: string): Promise<void> {
  const username = await requireUser();
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('Invalid push subscription.');
  if (!isPushEndpoint(sub.endpoint)) throw new Error('Unsupported push service.');
  const supabase = getSupabase();
  if (replacesEndpoint && replacesEndpoint !== sub.endpoint) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', replacesEndpoint).eq('username', username);
  }
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: sub.endpoint, username, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 300),
  });
  if (error) throw new Error(`Could not save this device: ${error.message}`);
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const username = await requireUser();
  await getSupabase().from('push_subscriptions').delete().eq('endpoint', endpoint).eq('username', username);
}

export async function isPushSubscriptionSaved(endpoint: string): Promise<boolean> {
  const username = await requireUser();
  const { data } = await getSupabase().from('push_subscriptions').select('endpoint').eq('endpoint', endpoint).eq('username', username).maybeSingle();
  return !!data;
}

export async function sendTestPush(): Promise<number> {
  const username = await requireUser();
  return sendPush(username, { title: '✅ Notora notifications are on', body: "You'll get a morning plan and an evening check-in.", url: '/', tag: 'test' });
}
