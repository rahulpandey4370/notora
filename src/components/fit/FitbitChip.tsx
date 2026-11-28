import { useEffect } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Loader2, RefreshCw, Watch } from 'lucide-react';
import { syncHealthNow } from '@/lib/health-actions';
import { connectResult, shown } from '@/lib/health-status';
import { useHealthStatus } from '@/hooks/health-status-store';
import { useApp } from '@/hooks/use-app';

/** Small Fitbit status in the hero: synced X ago (tap to sync) or Reconnect. */
export function FitbitChip() {
  const { reload, toast } = useApp();
  const { status: fitbit, busy, refresh, run } = useHealthStatus();

  // Result of the Google redirect (?health=connected|error&message=...). Read here because the chip is on the Logs
  // page from the start; the Manage trackers card only exists while its sheet is open. The URL is cleaned first, so
  // a second run finds nothing to announce.
  useEffect(() => {
    const result = connectResult(window.location.search);
    if (!result) return;
    window.history.replaceState(null, '', window.location.pathname);
    const { reload: connected, ...message } = result;
    toast(message);
    if (connected) void reload();
  }, [toast, reload]);

  const status = shown(fitbit);
  if (!status || status.state === 'disconnected') return null;
  if (status.state === 'reconnect') {
    return <a className="f-chip f-bad" href="/api/health/connect"><Watch className="h-3.5 w-3.5" aria-hidden />Reconnect Fitbit</a>;
  }
  const sync = () => run(async () => {
    const r = await syncHealthNow();
    if (!r.ok) toast({ variant: 'destructive', title: 'Fitbit sync problem', description: r.message });
    await Promise.all([reload(), refresh()]);
  });
  const ago = status.lastSyncAt ? `${formatDistanceToNowStrict(new Date(status.lastSyncAt))} ago` : 'not synced yet';
  return (
    <button type="button" className="f-chip" onClick={sync} disabled={busy} aria-label={`Fitbit synced ${ago}. Sync now`}>
      <Watch className="h-3.5 w-3.5" aria-hidden />Fitbit · {ago}
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}
