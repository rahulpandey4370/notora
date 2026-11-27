import { useMemo, useState } from 'react';
import { Medal, Minus, TrendingDown, TrendingUp, Utensils } from 'lucide-react';
import type { AppData } from '@/lib/types';
import { findTracker } from '@/lib/fitness';
import { foodInsights, patterns, records, whatIf } from '@/lib/insights';
import { kcalFloor, type RealBurn } from '@/lib/real-burn';

const k = (n: number) => Math.round(n).toLocaleString('en-IN');
const short = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Patterns between your logs and Fitbit data, a what-if goal date, personal records and what your food does. */
export function InsightsCard({ data, today, burn, trendKg }: { data: AppData; today: string; burn: RealBurn; trendKg?: number }) {
  const p = useMemo(() => patterns(data, today), [data, today]);
  const r = useMemo(() => records(data, today), [data, today]);
  const f = useMemo(() => foodInsights(data, today), [data, today]);
  const [deficit, setDeficit] = useState(500);
  const goal = findTracker(data, 'weight')?.goal;
  const w = trendKg != null && goal != null ? whatIf(trendKg, goal, deficit, today) : null;
  const floor = kcalFloor(data, today);
  const eat = burn.ok ? burn.real - deficit : null;

  return (
    <div className="space-y-5">
      <section aria-label="Patterns">
        <h3 className="text-sm font-semibold">Patterns in your data</h3>
        <p className="f-muted text-xs">Your last 90 days of food, sleep, steps, heart rate and weight. Patterns, not proof.</p>
        {!p.length ? <p className="f-muted mt-2 text-sm">Not enough overlap yet. Each pattern needs at least 4 days on each side, so keep logging food and wearing the Fitbit.</p> : (
          <ul className="mt-2 space-y-2">
            {p.map(x => {
              const Icon = x.tone === 'good' ? TrendingUp : x.tone === 'bad' ? TrendingDown : Minus;
              return (
                <li key={x.id} className="flex gap-3 rounded-2xl bg-[var(--f-tint)] p-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${x.tone === 'good' ? 'f-good' : x.tone === 'bad' ? 'f-bad' : 'f-muted'}`} aria-hidden />
                  <span><span className="block text-sm font-medium">{x.text}</span><span className="f-muted block text-xs">{x.detail}</span></span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {trendKg != null && goal != null && goal < trendKg && (
        <section aria-label="What if" className="rounded-2xl border border-[var(--f-line)] p-4">
          <h3 className="text-sm font-semibold">What if?</h3>
          <label className="mt-2 block text-sm">
            <span className="flex justify-between"><span>Daily deficit</span><strong className="tabular-nums">{k(deficit)} kcal</strong></span>
            <input type="range" min={100} max={1100} step={50} value={deficit} onChange={e => setDeficit(Number(e.target.value))} className="mt-2 w-full accent-[var(--f-deep)]" aria-label="Daily calorie deficit" />
          </label>
          {w && (
            <p className="mt-2 text-sm leading-relaxed">
              Lose <strong>{w.perWeek.toFixed(2)} kg/week</strong> and reach <strong>{goal} kg</strong> around <strong>{short(w.date)}</strong> ({Math.round(w.weeks)} weeks).
              {eat != null && <> That means eating about <strong className={eat < floor ? 'f-bad' : ''}>{k(eat)} kcal</strong> a day from your real burn{eat < floor ? `, under your safe minimum of ${k(floor)}: pick a smaller deficit` : ''}.</>}
            </p>
          )}
        </section>
      )}

      {r.length > 0 && (
        <section aria-label="Personal records">
          <h3 className="text-sm font-semibold">Personal records</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {r.map(x => (
              <li key={x.id} className="rounded-2xl bg-[var(--f-tint)] p-3">
                <Medal className="h-4 w-4 text-[var(--f-sun)]" aria-hidden />
                <p className="f-muted mt-1 text-[11px] font-semibold uppercase tracking-[0.1em]">{x.label}</p>
                <p className="text-base font-bold tabular-nums">{x.value}</p>
                {x.date && <p className="f-muted text-xs">{x.date}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(f.protein.length > 0 || f.over) && (
        <section aria-label="Your food">
          <h3 className="text-sm font-semibold">Your food, last 60 days</h3>
          {f.over && <p className="mt-1 text-sm"><strong>{f.over.label}</strong> went over its calorie budget on <strong>{f.over.days} of {f.over.of}</strong> days, so it’s the meal to plan.</p>}
          {f.protein.length > 0 && (
            <>
              <p className="f-muted mt-3 text-xs font-semibold uppercase tracking-[0.1em]">Best protein for the calories</p>
              <ul className="f-card mt-1 overflow-hidden">
                {f.protein.map(x => (
                  <li key={x.name} className="f-row"><Utensils className="h-4 w-4 shrink-0 text-[var(--f-chart-a)]" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm">{x.name}</span>
                    <span className="f-muted shrink-0 text-xs tabular-nums">{Math.round(x.proteinShare * 100)}% protein · {x.times}×</span></li>
                ))}
              </ul>
              <p className="f-muted mt-3 text-xs font-semibold uppercase tracking-[0.1em]">Biggest calorie sources</p>
              <ul className="f-card mt-1 overflow-hidden">
                {f.biggest.map(x => (
                  <li key={x.name} className="f-row"><Utensils className="h-4 w-4 shrink-0 text-[var(--f-chart-b)]" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm">{x.name}</span>
                    <span className="f-muted shrink-0 text-xs tabular-nums">{k(x.total)} kcal · {x.times}× ({k(x.kcal)} each)</span></li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
