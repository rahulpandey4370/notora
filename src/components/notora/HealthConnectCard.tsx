'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Watch, RefreshCw, Loader2, Unplug } from 'lucide-react';
import { useApp } from '@/hooks/use-app';
import { getHealthStatus, syncHealthNow, disconnectHealth, type HealthStatus } from '@/lib/health-actions';

/** Connect / sync / reconnect Fitbit (via Google Health). Data lands in the Steps, Sleep and Resting heart rate trackers. Styled for the Logs page (inside .fit-ui). */
export default function HealthConnectCard() {
  const { toast, reload } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => getHealthStatus().then(setStatus).catch(() => setStatus({ state: 'unavailable' })), []);
  useEffect(() => { void refresh(); }, [refresh]);

  // Result of the Google redirect (?health=connected|error&message=...).
  useEffect(() => {
    const result = params.get('health');
    if (!result) return;
    const message = params.get('message') ?? undefined;
    if (result === 'connected') { toast({ title: 'Fitbit connected', description: message }); void reload(); }
    else if (result === 'not_configured') toast({ variant: 'destructive', title: 'Fitbit sync is not set up on the server yet' });
    else toast({ variant: 'destructive', title: "Couldn't connect Fitbit", description: message });
    router.replace('/logs');
  }, [params, toast, reload, router]);

  if (!status || status.state === 'unavailable') return null;

  const sync = async () => {
    setBusy(true);
    const r = await syncHealthNow().catch((e: Error) => ({ ok: false, message: e.message }));
    toast({ variant: r.ok ? 'default' : 'destructive', title: r.ok ? 'Fitbit synced' : 'Fitbit sync problem', description: r.message });
    await Promise.all([reload(), refresh()]);
    setBusy(false);
  };

  const disconnect = async () => {
    setBusy(true);
    await disconnectHealth().catch(() => {});
    await refresh();
    setBusy(false);
  };

  const connectHref = '/api/health/connect';
  return (
    <div className="f-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--f-tint)]"><Watch className="h-5 w-5 text-[var(--f-deep)]" aria-hidden /></span>
          <div className="min-w-0">
            <p className="font-medium">Fitbit</p>
            <p className="f-muted text-sm">
              {status.state === 'disconnected' && 'Fill Steps, Sleep and Resting heart rate automatically.'}
              {status.state === 'reconnect' && status.message}
              {status.state === 'connected' && (status.lastSyncAt
                ? `Synced ${formatDistanceToNow(new Date(status.lastSyncAt), { addSuffix: true })}`
                : 'Connected, not synced yet')}
            </p>
            {status.state === 'connected' && status.lastError && (
              <p className="f-bad text-xs break-words">{status.lastError}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {status.state === 'connected' ? (
            <>
              <button type="button" className="f-pill flex-1 sm:flex-none" onClick={sync} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}Sync now
              </button>
              <button type="button" className="f-icon-btn h-11 w-11" onClick={disconnect} disabled={busy} aria-label="Disconnect Fitbit">
                <Unplug className="h-4 w-4" />
              </button>
            </>
          ) : (
            <a className="f-pill f-pill-primary flex-1 sm:flex-none" href={connectHref}>{status.state === 'reconnect' ? 'Reconnect' : 'Connect'}</a>
          )}
        </div>
    </div>
  );
}
