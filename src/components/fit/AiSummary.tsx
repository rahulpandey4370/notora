import { useEffect, useRef, useState } from 'react';
import { Lightbulb, RefreshCw, Sparkles } from 'lucide-react';
import type { AppData } from '@/lib/types';
import { useModelFor } from '@/hooks/use-model-store';
import { useAsk } from '@/hooks/use-ask';
import { addDays, dayBurn, dayIntake, findTracker, trendSeries, valueOn, weeklyRate } from '@/lib/fitness';
import { summarizeFitness, type FitnessDayRow, type SummarizeFitnessOutput } from '@/ai/flows/summarize-fitness';

type Period = '7' | '30' | 'custom';
const KEY = 'fit-ai-summary'; // last result, per device
const short = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const DEMO: SummarizeFitnessOutput = {
  headline: 'A steady week: about 300 kcal/day under your burn, so the trend keeps edging down.',
  highlights: ['Calories: 1,980 in vs 2,290 burned on average (−310/day).', 'Protein averaged 92 g, short of your 150 g target.', 'Steps averaged 8,860; 10k+ on 3 of 7 days.', 'Sleep averaged 6.8 h, a little under 7.'],
  suggestion: 'Add one 30 g protein snack a day (curd, paneer or a shake) to close the protein gap.',
};

function rowsFor(data: AppData, from: string, to: string): FitnessDayRow[] {
  const byMetric = (m: string) => data.logTrackers.find(t => t.healthMetric === m);
  const t = { steps: findTracker(data, 'steps'), sleep: findTracker(data, 'sleep'), rhr: findTracker(data, 'restingHr'), weight: findTracker(data, 'weight'), hrv: byMetric('hrv'), azm: byMetric('azm') };
  const rows: FitnessDayRow[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const intake = dayIntake(data, d);
    const acts = [...(data.fitnessDays?.[d]?.activities ?? []), ...(data.fitbitWorkouts?.[d] ?? [])];
    rows.push({
      date: d, intakeKcal: intake.kcal, proteinG: intake.proteinG, burnKcal: dayBurn(data, d).total ?? undefined,
      steps: valueOn(t.steps, d), sleepH: valueOn(t.sleep, d), restingHr: valueOn(t.rhr, d), weightKg: valueOn(t.weight, d),
      hrvMs: valueOn(t.hrv, d), azm: valueOn(t.azm, d),
      workouts: acts.length ? acts.map(a => `${a.name} ${Math.round(a.minutes)}m`).join(', ') : undefined,
    });
  }
  return rows;
}

/** On-demand AI review of a period (last 7 / 30 days or custom), generated with the ↻ button. */
export function AiSummary({ data, today, aiDisabled }: { data: AppData; today: string; aiDisabled?: boolean }) {
  const selectedModel = useModelFor('summaries');
  const [period, setPeriod] = useState<Period>('7');
  const [custom, setCustom] = useState({ from: addDays(today, -13), to: today });
  // lib/ask: idle → pending (the last summary stays on show) → ready | failed.
  const sum = useAsk<{ key: string; out: SummarizeFitnessOutput }>();
  const result = sum.value ?? null, busy = sum.pending, error = sum.error;

  const from = period === 'custom' ? custom.from : addDays(today, -(Number(period) - 1));
  const to = period === 'custom' ? custom.to : today;
  const key = `${from}_${to}`;
  const validRange = from <= to && to <= today;

  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved?.key && saved?.out) sum.set(saved); } catch { /* nothing saved */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    if (busy || !validRange) return;
    if (aiDisabled) { sum.set({ key, out: DEMO }); return; }
    const next = await sum.run(async () => {
      const weight = findTracker(data, 'weight');
      const series = trendSeries(weight?.logs ?? []);
      const out = await summarizeFitness({
        from, to, rows: rowsFor(data, from, to),
        goals: { kcal: findTracker(data, 'intake')?.goal, proteinG: findTracker(data, 'protein')?.goal, steps: findTracker(data, 'steps')?.goal, weightKg: weight?.goal },
        trendWeightKg: series.length ? series[series.length - 1].trend : undefined,
        weeklyRateKg: weeklyRate(series, today) ?? undefined,
      }, selectedModel);
      return { key, out };
    }, { keep: true, error: "Couldn't create the summary. Check your connection and try again." });
    // Saved only when this reply was the one shown (not a late one).
    if (next) try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not saved */ }
  };

  const shown = result?.key === key ? result.out : null;
  return (
    <section className="f-card p-5" aria-label="AI summary">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="fit-display text-2xl">AI <em>summary</em></h2>
          <p className="f-muted text-xs">{short(from)} – {short(to)}</p>
        </div>
        <button type="button" className="f-icon-btn h-11 w-11 shrink-0" onClick={() => void run()} disabled={busy || !validRange}
          aria-label={shown ? 'Regenerate the summary' : 'Generate the summary'} title={shown ? 'Regenerate' : 'Generate'}>
          <RefreshCw className={`h-5 w-5 ${busy ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Summary period">
        {([['7', 'Last 7 days'], ['30', 'Last 30 days'], ['custom', 'Custom']] as const).map(([p, label]) => (
          <button key={p} type="button" className="f-chip" data-on={period === p} aria-pressed={period === p} onClick={() => setPeriod(p)}>{label}</button>
        ))}
        {period === 'custom' && (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <input type="date" className="f-input !w-auto !py-1.5" value={custom.from} max={today} aria-label="From"
              onChange={e => e.target.value && setCustom(c => ({ ...c, from: e.target.value }))} />
            <span className="f-muted">to</span>
            <input type="date" className="f-input !w-auto !py-1.5" value={custom.to} max={today} aria-label="To"
              onChange={e => e.target.value && setCustom(c => ({ ...c, to: e.target.value }))} />
          </span>
        )}
      </div>
      {!validRange && <p className="f-bad mt-2 text-xs">Pick a start date on or before the end date.</p>}

      <div className="mt-4" aria-live="polite">
        {busy ? (
          <div className="space-y-2" aria-label="Writing your summary">
            {[80, 95, 70, 88].map(w => <div key={w} className="h-3 animate-pulse rounded bg-[var(--f-tint)]" style={{ width: `${w}%` }} />)}
          </div>
        ) : shown ? (
          <div className="space-y-3">
            <p className="fit-display text-xl leading-snug">{shown.headline}</p>
            <ul className="space-y-1.5 text-sm">
              {shown.highlights.map((h, i) => <li key={i} className="flex gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--f-accent)]" aria-hidden />{h}</li>)}
            </ul>
            <p className="flex gap-2 rounded-2xl bg-[var(--f-tint)] p-3 text-sm"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--f-deep)]" aria-hidden />{shown.suggestion}</p>
          </div>
        ) : (
          <p className="f-muted text-sm">Tap ↻ for an AI review of this period: calories, protein, steps, sleep and weight.</p>
        )}
        {error && <p className="f-bad mt-2 text-sm">{error}</p>}
      </div>
    </section>
  );
}
