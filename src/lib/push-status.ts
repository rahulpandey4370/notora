// Push notifications on this device as one named state: what the browser, the permission, the service worker and the
// server's copy of the subscription add up to. hooks/use-push-notifications holds one PushStatus for the whole app and
// sets it from here; the browser calls stay there. Pure; checked by `npx tsx src/lib/push-status.check.ts`.

/**
 * 'unsupported': this browser has no push at all (an iPhone Safari tab, before Add to Home Screen).
 * 'unavailable': push exists but no service worker answered (it is off in development, and still installing on a first visit).
 * 'blocked': the user (or the browser) said no; only Settings can undo it.
 */
export type PushStatus = 'loading' | 'unsupported' | 'unavailable' | 'blocked' | 'off' | 'on';

type Permission = 'default' | 'granted' | 'denied';

export type PushFacts = {
  /** Service workers, PushManager and Notification all exist. */
  supported: boolean;
  permission: Permission;
  /** A service worker answered in time. */
  worker: boolean;
  /** This browser holds a push subscription… */
  subscribed: boolean;
  /** …and the server still sends to it. */
  saved: boolean;
};

export function pushStatus(f: PushFacts): Exclude<PushStatus, 'loading'> {
  if (!f.supported) return 'unsupported';
  if (f.permission === 'denied') return 'blocked';
  if (!f.worker) return 'unavailable';
  return f.permission === 'granted' && f.subscribed && f.saved ? 'on' : 'off';
}

/** The permission prompt's answer: null means allowed, carry on. Only a real "denied" is blocked; a dismissed prompt ('default') leaves the button usable. */
export const refusal = (answer: Permission): 'blocked' | 'off' | null =>
  answer === 'granted' ? null : answer === 'denied' ? 'blocked' : 'off';
