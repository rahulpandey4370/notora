import type { Stored } from '@/lib/storage';

// The last server-confirmed copy of the workspace on this device, shown instantly
// on the next open while a fresh copy loads. Never holds unsaved edits.
const cacheKey = (username: string) => `notora-cache:${username.toLowerCase()}`;
export function readCache(username: string): Stored | null {
  try { const v = JSON.parse(localStorage.getItem(cacheKey(username)) || 'null'); return v?.data && v?.version ? v : null; } catch { return null; }
}
export function writeCache(username: string, stored: Stored) {
  const run = () => { try { localStorage.setItem(cacheKey(username), JSON.stringify(stored)); } catch { /* full or blocked: just no instant open */ } };
  const idle = (window as any).requestIdleCallback as ((cb: () => void) => void) | undefined;
  if (idle) idle(run); else setTimeout(run, 0);
}
export function clearDeviceCache() {
  try { Object.keys(localStorage).filter(k => k.startsWith('notora-cache:')).forEach(k => localStorage.removeItem(k)); } catch { /* nothing cached */ }
}
