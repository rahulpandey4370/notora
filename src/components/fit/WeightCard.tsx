import { useMemo, useState } from 'react';
import { ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingDown, TrendingUp, Minus, Target } from 'lucide-react';
import type { AppData } from '@/lib/types';
import { addDays, findTracker, goalEta, trendSeries, weeklyRate } from '@/lib/fitness';

const RANGES = [{ id: '30', label: '30d', days: 30 }, { id: '90', label: '90d', days: 90 }, { id: 'all', label: 'All', days: Infinity }] as const;
const short = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Trend weight (smoothed), weekly rate and goal ETA, with daily weigh-ins as dots. */
export function WeightCard({ data, today, onSetGoal }: { data: AppData; today: string; onSetGoal: () => void }) {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('90');
  const weight = findTracker(data, 'weight');
  const series = useMemo(() => trendSeries(weight?.logs ?? []), [weight]);
  const goal = weight?.goal;

  if (!series.length) {
    return (
      <section className="f-card p-5" aria-label="Weight">
        <h2 className="fit-display text-2xl">Weight</h2>
        <p className="f-muted mt-2 text-sm">No weigh-ins yet. Say “94.2 kg” in Log it to start your trend.</p>
      </section>
    );
  }

  const last = series[series.length - 1];
  const rate = weeklyRate(series, today);
  const eta = goalEta(last.trend, rate, goal, today);
  const days = RANGES.find(r => r.id === range)!.days;
  const from = Number.isFinite(days) ? addDays(today, -days + 1) : series[0].date;
  const shown = series.filter(p => p.date >= from).map(p => ({ ...p, trend: Math.round(p.trend * 10) / 10 }));
  const values = shown.flatMap(p => [p.trend, p.weight ?? p.trend]).concat(shown.length && goal != null ? [goal] : []);
  const lo = Math.floor(Math.min(...values) - 0.5), hi = Math.ceil(Math.max(...values) + 0.5);
  const stale = last.date < addDays(today, -6);
  const down = rate != null && rate < -0.05, up = rate != null && rate > 0.05;
  const goodDirection = goal == null ? down : (goal < last.trend ? down : up);
  const RateIcon = down ? TrendingDown : up ? TrendingUp : Minus;

  return (
    <section className="f-card p-5" aria-label="Weight trend">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="f-muted text-xs font-semibold uppercase tracking-wide">Trend weight</h2>
          <p className="fit-display mt-1 text-[2.4rem]">{last.trend.toFixed(1)} <span className="text-xl">kg</span></p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {rate == null ? (
              <span className="f-muted">{stale ? `Last weigh-in ${short(last.date)}. Log a few to see your rate.` : 'Log 7+ weigh-ins in 4 weeks to see your rate.'}</span>
            ) : (
              <span className={`inline-flex items-center gap-1 font-semibold ${goodDirection ? 'f-good' : (down || up) ? 'f-bad' : ''}`}>
                <RateIcon className="h-4 w-4" aria-hidden />
                {rate > 0 ? '+' : rate < 0 ? '−' : ''}{Math.abs(rate).toFixed(2)} kg/week
              </span>
            )}
            {goal != null && (
              <span className="f-muted inline-flex items-center gap-1">
                <Target className="h-3.5 w-3.5" aria-hidden />Goal {goal} kg{eta ? <> · ≈ <strong className="text-[var(--f-ink)]">{short(eta)}</strong></> : rate != null ? ' · not trending toward it yet' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Chart range">
          {RANGES.map(r => <button key={r.id} type="button" className="f-chip" data-on={range === r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>)}
        </div>
      </div>

      {!shown.length ? (
        <div className="f-muted mt-4 flex h-56 flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--f-tint)] text-center text-sm">
          <p>No weigh-ins in the last {RANGES.find(r => r.id === range)!.label}.</p>
          <button type="button" className="f-chip" onClick={() => setRange('all')}>Show all</button>
        </div>
      ) : (
      <div className="mt-4 h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={shown} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--f-line)" />
            <XAxis dataKey="date" tickFormatter={short} minTickGap={36} tickLine={false} axisLine={false} />
            <YAxis domain={[lo, hi]} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: 'var(--f-card)', border: '1px solid var(--f-line)', borderRadius: 12, color: 'var(--f-ink)' }}
              labelFormatter={(d: string) => short(d)}
              formatter={(v: number, name: string) => [`${Number(v).toFixed(1)} kg`, name === 'trend' ? 'Trend' : 'Weigh-in']} />
            {goal != null && <ReferenceLine y={goal} stroke="var(--f-good)" strokeDasharray="5 5" label={{ value: `Goal ${goal}`, position: 'insideTopRight', fill: 'var(--f-good)', fontSize: 11 }} />}
            <Scatter dataKey="weight" fill="var(--f-sec)" fillOpacity={0.45} shape="circle" isAnimationActive={false} />
            <Line dataKey="trend" type="monotone" stroke="var(--f-deep)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      )}
      <p className="sr-only">Trend weight {last.trend.toFixed(1)} kg{rate != null ? `, changing ${rate.toFixed(2)} kg per week` : ''}{goal != null ? `, goal ${goal} kg` : ''}.</p>
      {goal == null && (
        <button type="button" className="f-pill mt-3" onClick={onSetGoal}><Target className="h-4 w-4" aria-hidden />Set a weight goal</button>
      )}
    </section>
  );
}
