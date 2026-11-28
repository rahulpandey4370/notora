"use client";

import { useEffect } from 'react';
import { create } from 'zustand';
import { isPushSubscriptionSaved, removePushSubscription, savePushSubscription, sendTestPush } from '@/lib/push-actions';
import { pushStatus, refusal, type PushFacts, type PushStatus } from '@/lib/push-status';

/**
 * Push notifications on this device: whether they're on, and turning them on or off.
 * On iPhone this only works from the Home Screen app (iOS 16.4+), not a Safari tab.
 * One status and one busy flag for the whole app (the account menu and the Profile page show the same thing);
 * what the status means is decided in lib/push-status.
 */
export type { PushStatus };

const useStore = create<{ status: PushStatus; busy: boolean }>(() => ({ status: 'loading', busy: false }));

let request = 0;     // only the newest status check counts; turning on or off outdates any check still out
let mounted = 0;     // components showing the status right now
let waiting = false; // already waiting for a late service worker

const setStatus = (status: PushStatus) => { request++; useStore.setState({ status }); };

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const NOT_READY = "Notifications aren't ready on this device yet. Reload the app and try again.";

/** The active service worker, or null when none answers in time. `ready` alone never settles without one (it is off in development, and still installing on a first visit). */
const workerReady = (ms = 3000) =>
  Promise.race([navigator.serviceWorker.ready, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))]);

async function readFacts(): Promise<PushFacts> {
  const none: PushFacts = { supported: false, permission: 'default', worker: false, subscribed: false, saved: false };
  if (!supported()) return none;
  const permission = Notification.permission;
  if (permission === 'denied') return { ...none, supported: true, permission };
  const registration = await workerReady();
  if (!registration) return { ...none, supported: true, permission };
  const sub = await registration.pushManager.getSubscription();
  // "On" means this phone has a subscription and the server still sends to it.
  const saved = !!sub && permission === 'granted' && (await isPushSubscriptionSaved(sub.endpoint));
  return { supported: true, permission, worker: true, subscribed: !!sub, saved };
}

async function refresh(): Promise<void> {
  const id = ++request;
  const status = await readFacts().then(pushStatus, () => 'off' as const);
  if (id !== request) return;
  useStore.setState({ status });
  // A worker that turns up late (first visit) makes the button usable without a reload.
  if (status === 'unavailable' && !waiting) {
    waiting = true;
    void navigator.serviceWorker.ready.then(() => { waiting = false; void refresh(); });
  }
}

/** Turns on with a fresh subscription (an old one can go stale on iPhone) and sends a test. */
async function enable(): Promise<void> {
  if (!supported()) throw new Error('On iPhone: open Notora in Safari, tap Share → Add to Home Screen, then turn notifications on from the Home Screen app.');
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error('Push is not set up on the server (NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing).');
  // Known to have no service worker: say so without asking for a permission that can't be used yet.
  if (useStore.getState().status === 'unavailable') throw new Error(NOT_READY);
  useStore.setState({ busy: true });
  try {
    const refused = refusal(await Notification.requestPermission());
    if (refused) {
      setStatus(refused);
      throw new Error(refused === 'blocked'
        ? 'Allow notifications for Notora in iPhone Settings → Notifications.'
        : "Notifications weren't turned on. Try again and choose Allow.");
    }
    const registration = await workerReady();
    if (!registration) { setStatus('unavailable'); throw new Error(NOT_READY); }
    const old = await registration.pushManager.getSubscription();
    await old?.unsubscribe().catch(() => {});
    const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
    await savePushSubscription(sub.toJSON(), navigator.userAgent, old?.endpoint);
    setStatus('on');
    if (!(await sendTestPush())) throw new Error("Notifications are on, but the test didn't reach this phone. Try again in a minute.");
  } finally {
    useStore.setState({ busy: false });
  }
}

async function disable(): Promise<void> {
  useStore.setState({ busy: true });
  try {
    const sub = supported() ? await (await workerReady())?.pushManager.getSubscription() : null;
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe().catch(() => {});
    }
    setStatus('off');
  } finally {
    useStore.setState({ busy: false });
  }
}

export function usePushNotifications() {
  const { status, busy } = useStore();
  useEffect(() => {
    // The first one on screen starts from 'loading': nothing is left over from an earlier visit or another account.
    if (mounted++ === 0) useStore.setState({ status: 'loading' });
    void refresh();
    return () => { mounted--; };
  }, []);
  return { status, busy, enable, disable, test: sendTestPush };
}
