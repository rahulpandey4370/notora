// The Fitbit connection as the Logs page sees it: one status for the hero chip and the Manage trackers card
// (hooks/health-status-store holds it), and what the Google redirect's ?health= result says.
// Pure; checked by `npx tsx src/lib/health-status.check.ts`.
import type { HealthStatus } from './health-actions';

/**
 * The server's HealthStatus plus the two things only the client knows:
 * 'loading' (not answered yet) and 'failed' (the status request itself failed).
 * 'unavailable' stays what the server means by it: Fitbit sync is not set up.
 */
export type FitbitStatus = { state: 'loading' } | { state: 'failed' } | HealthStatus;

/** The status when there is something to show for it, else null (loading, failed, not set up). */
export function shown(status: FitbitStatus): Exclude<HealthStatus, { state: 'unavailable' }> | null {
  return status.state === 'loading' || status.state === 'failed' || status.state === 'unavailable' ? null : status;
}

export type ConnectResult = { variant?: 'destructive'; title: string; description?: string; reload: boolean };

/** The toast for the Google redirect back to /logs (?health=connected|not_configured|error&message=...); null when the URL carries no result. */
export function connectResult(search: string): ConnectResult | null {
  const params = new URLSearchParams(search);
  const result = params.get('health');
  if (!result) return null;
  const description = params.get('message') ?? undefined;
  if (result === 'connected') return { title: 'Fitbit connected', description, reload: true };
  if (result === 'not_configured') return { variant: 'destructive', title: 'Fitbit sync is not set up on the server yet', reload: false };
  return { variant: 'destructive', title: "Couldn't connect Fitbit", description, reload: false };
}
