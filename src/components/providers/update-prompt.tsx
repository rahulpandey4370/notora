'use client';

import { useEffect, useState } from 'react';

/**
 * "New version ready · Refresh". The home-screen app is resumed far more often than it is relaunched, so after a
 * deploy it keeps running the old screens until fully closed. When a new service worker takes over an already
 * controlled page (workbox uses skipWaiting + clientsClaim), offer a one-tap reload; and look for an update each
 * time the app comes back to the front. Off in development, where there is no service worker.
 */
export default function UpdatePrompt() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    if (!sw) return;
    // No controller yet = first install on this device: nothing older is on screen, so nothing to refresh.
    let had = !!sw.controller;
    const onChange = () => { if (had) setReady(true); had = true; };
    const check = () => { if (document.visibilityState === 'visible') void sw.getRegistration().then(r => r?.update()).catch(() => {}); };
    sw.addEventListener('controllerchange', onChange);
    document.addEventListener('visibilitychange', check);
    return () => { sw.removeEventListener('controllerchange', onChange); document.removeEventListener('visibilitychange', check); };
  }, []);
  if (!ready) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[110] mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-background px-4 py-2 text-sm shadow-lg">
      <span className="min-w-0 flex-1">A new version is ready.</span>
      <button type="button" className="h-11 shrink-0 rounded-full bg-primary px-4 font-semibold text-primary-foreground" onClick={() => window.location.reload()}>Refresh</button>
      <button type="button" className="h-11 shrink-0 px-2 text-muted-foreground" onClick={() => setReady(false)}>Later</button>
    </div>
  );
}
