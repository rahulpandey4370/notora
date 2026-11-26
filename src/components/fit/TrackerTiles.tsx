import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { Settings2 } from 'lucide-react';
import type { AppData, LogTracker } from '@/lib/types';
import { addDays, dayBurn, findTracker, valueOn } from '@/lib/fitness';

// Falling is good for these (same list LogTrackerCard uses).
const DECREASE_IS_GOOD = new Set(['Weight', 'Daily Calorie Intake', 'Resting heart rate']);
const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n * 10) / 10));

function seriesFor(data: AppData, t: LogTracker, today: string) {
  const isBurn = t === findTracker(data, 'burned');
  return Array.from({ length: 15 }, (_, i) => {
    const d = addDays(today, i - 14);
    const v = isBurn ? dayBurn(data, d).total ?? undefined : valueOn(t, d);
    return { d, v: v == null ? undefined : Math.round(v * 10) / 10 };
  });
}

/** Compact tiles: latest value, 14-day sparkline, change vs the week before. Tap for the full card. */
export function TrackerTiles({ data, today, onOpen, onManage }: { data: AppData; today: string; onOpen: (trackerId: string) => void; onManage: () => void }) {
  const tiles = useMemo(() => (data.logTrackers ?? []).map(t => {
    const s = seriesFor(data, t, today);
    const vals = s.map(p => p.v);
    // Latest in the window, else the last entry ever (with its date), so tiles aren't blank after a break.
    const recent = [...s].reverse().find(p => p.v != null);
    const lastEver = [...t.logs].filter(l => l.value).sort((a, b) => b.date.localeCompare(a.date))[0];
    const latest = recent ?? (lastEver ? { d: lastEver.date, v: lastEver.value } : undefined);
    const stale = !recent && !!latest;
    const mean = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    // The 7 full days before today vs the 7 before those: a half-logged today would skew it.
    const thisWeek = mean(vals.slice(7, 14)), lastWeek = mean(vals.slice(0, 7));
    const change = thisWeek != null && lastWeek ? (thisWeek - lastWeek) / lastWeek : null;
    return { t, s, latest, change, stale };
  }), [data, today]);

  return (
    <section aria-label="Trackers">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="fit-display text-2xl">Trackers</h2>
        <button type="button" className="f-chip" onClick={onManage}><Settings2 className="h-3.5 w-3.5" aria-hidden />Manage</button>
      </div>
      {!tiles.length ? (
        <p className="f-muted text-sm">No trackers yet. Log something above, or add one in Manage.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {tiles.map(({ t, s, latest, change, stale }) => {
            const good = change == null || Math.abs(change) < 0.01 ? null : (change < 0) === DECREASE_IS_GOOD.has(t.name);
            return (
              <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="f-card flex min-h-[8.5rem] flex-col p-3 text-left"
                aria-label={`${t.name}: ${latest ? `${fmt(latest.v!)} ${t.unit}` : 'no recent value'}${change != null ? `, ${change > 0 ? 'up' : 'down'} ${Math.abs(Math.round(change * 100))}% vs last week` : ''}. Open details`}>
                <span className="f-muted truncate text-xs font-semibold">{t.name}{t.healthMetric ? ' · Fitbit' : ''}</span>
                <span className="mt-1 text-xl font-bold tabular-nums">{latest ? fmt(latest.v!) : '—'} <span className="f-muted text-xs font-normal">{t.unit}</span></span>
                {stale && <span className="f-muted text-xs">on {new Date(`${latest!.d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                {change != null && Math.abs(change) >= 0.01 && (
                  <span className={`text-xs font-semibold ${good ? 'f-good' : 'f-bad'}`}>{change > 0 ? '▲' : '▼'} {Math.abs(Math.round(change * 100))}% vs last week</span>
                )}
                <div className="mt-auto h-10" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={s}>
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <Line dataKey="v" type="monotone" stroke="var(--f-accent)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
