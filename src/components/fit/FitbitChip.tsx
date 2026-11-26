import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Loader2, RefreshCw, Watch } from 'lucide-react';
import { getHealthStatus, syncHealthNow, type HealthStatus } from '@/lib/health-actions';
import { useApp } from '@/hooks/use-app';

/** Small Fitbit status in the hero: synced X ago (tap to sync) or Reconnect. */
export function FitbitChip() {
  const { reload, toast } = useApp();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => getHealthStatus().then(setStatus).catch(() => setStatus(null)), []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (!status || status.state === 'unavailable' || status.state === 'disconnected') return null;
  if (status.state === 'reconnect') {
    return <a className="f-chip f-bad" href="/api/health/connect"><Watch className="h-3.5 w-3.5" aria-hidden />Reconnect Fitbit</a>;
  }
  const sync = async () => {
    setBusy(true);
    try {
      const r = await syncHealthNow();
      if (!r.ok) toast({ variant: 'destructive', title: 'Fitbit sync problem', description: r.message });
      await Promise.all([reload(), refresh()]);
    } finally { setBusy(false); }
  };
  const ago = status.lastSyncAt ? `${formatDistanceToNowStrict(new Date(status.lastSyncAt))} ago` : 'not synced yet';
  return (
    <button type="button" className="f-chip" onClick={sync} disabled={busy} aria-label={`Fitbit synced ${ago}. Sync now`}>
      <Watch className="h-3.5 w-3.5" aria-hidden />Fitbit · {ago}
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}
