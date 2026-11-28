'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { getHealthStatus } from '@/lib/health-actions';
import type { FitbitStatus } from '@/lib/health-status';

// One Fitbit status and one busy flag for everything that shows them (the hero chip and the Manage trackers card),
// so a sync or disconnect in one updates the other. Not persisted: it is read from the server on every visit.
const useStore = create<{ status: FitbitStatus; busy: boolean }>(() => ({ status: { state: 'loading' }, busy: false }));

let request = 0; // only the newest status reply counts
let mounted = 0; // components showing the status right now

function refresh(): Promise<void> {
  const id = ++request;
  const apply = (status: FitbitStatus) => { if (id === request) useStore.setState({ status }); };
  return getHealthStatus().then(apply, () => apply({ state: 'failed' }));
}

/** Runs a Fitbit action (sync, disconnect) with `busy` set for every component, and always clears it. */
async function run(action: () => Promise<void>): Promise<void> {
  useStore.setState({ busy: true });
  try { await action(); } finally { useStore.setState({ busy: false }); }
}

export function useHealthStatus() {
  const { status, busy } = useStore();
  useEffect(() => {
    // The first one on screen starts from 'loading': nothing is left over from an earlier visit or another account.
    if (mounted++ === 0) useStore.setState({ status: { state: 'loading' } });
    void refresh();
    return () => { mounted--; };
  }, []);
  return { status, busy, refresh, run };
}
