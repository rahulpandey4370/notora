// Insights from your own logs and Fitbit data: patterns between them,
// personal records, a what-if goal date, and what your food does.
// Pure; checked by `npx tsx src/lib/insights.check.ts`. Dates are 'yyyy-MM-dd'.
// Sleep is credited to the day you WOKE UP, so "the night before day D" is
// sleep on D, and "the night after D" is sleep on D+1.
import type { AppData, LogTracker } from '@/lib/types';
import { MEAL_SLOTS, addDays, dayBurn, dayMacros, findTracker, fmtSleep, slotBudgets, trendSeries, valueOn } from '@/lib/fitness';
import { KCAL_PER_KG } from '@/lib/real-burn';

export type Pattern = { id: string; text: string; detail: string; tone: 'good' | 'bad' | 'neutral' };
export type Record_ = { id: string; label: string; value: string; date?: string };
const MIN_N = 4;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const k = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-IN');
const hm = fmtSleep;
const metric = (data: AppData, m: string) => data.logTrackers.find(t => t.healthMetric === m);

/** The days to look at: up to 90, ending yesterday (today is unfinished). */
const window_ = (today: string, n = 90) => Array.from({ length: n }, (_, i) => addDays(today, -1 - i));

/** Compare a value between two groups of days; null unless both have MIN_N days. */
function compare(days: string[], inA: (d: string) => boolean | null, value: (d: string) => number | undefined) {
  const a: number[] = [], b: number[] = [];
  for (const d of days) {
    const g = inA(d), v = value(d);
    if (g == null || v == null) continue;
    (g ? a : b).push(v);
  }
  return a.length >= MIN_N && b.length >= MIN_N ? { diff: mean(a) - mean(b), a: a.length, b: b.length } : null;
}

export function patterns(data: AppData, today: string): Pattern[] {
  const days = window_(today);
  const kcalGoal = findTracker(data, 'intake')?.goal, proteinGoal = findTracker(data, 'protein')?.goal;
  const full = (d: string) => { const m = dayMacros(data, d); return m.kcal >= (kcalGoal ? kcalGoal * 0.4 : 900) ? m : undefined; };
  const sleep = findTracker(data, 'sleep'), steps = findTracker(data, 'steps'), rhr = findTracker(data, 'restingHr'), hrv = metric(data, 'hrv');
  const stepGoal = steps?.goal || 10000;
  const short = (d: string) => { const s = valueOn(sleep, d); return s == null ? null : s < 6.5 ? true : s >= 7 ? false : null; };
  const out: Pattern[] = [];

  // Short night → that day's eating (same date: sleep is credited to the morning after).
  const eat = compare(days, short, d => full(d)?.kcal);
  if (eat && Math.abs(eat.diff) >= 100) out.push({ id: 'sleep-food', tone: eat.diff > 0 ? 'bad' : 'good',
    text: `After nights under 6½ h you eat ${k(eat.diff)} kcal ${eat.diff > 0 ? 'more' : 'less'} that day.`, detail: `${eat.a} short nights vs ${eat.b} nights of 7 h+` });
  // Short night → that day's steps.
  const walk = compare(days, short, d => valueOn(steps, d));
  if (walk && Math.abs(walk.diff) >= 800) out.push({ id: 'sleep-steps', tone: walk.diff < 0 ? 'bad' : 'good',
    text: `After short nights you walk ${k(walk.diff)} ${walk.diff < 0 ? 'fewer' : 'more'} steps.`, detail: `${walk.a} short nights vs ${walk.b} others` });
  // Active day → the night after (sleep on D+1).
  const rest = compare(days, d => { const s = valueOn(steps, d); return s == null ? null : s >= stepGoal; }, d => valueOn(sleep, addDays(d, 1)));
  if (rest && Math.abs(rest.diff) >= 0.25) out.push({ id: 'steps-sleep', tone: rest.diff > 0 ? 'good' : 'neutral',
    text: `On ${k(stepGoal)}+ step days you sleep ${hm(Math.abs(rest.diff))} ${rest.diff > 0 ? 'longer' : 'less'} that night.`, detail: `${rest.a} active days vs ${rest.b} others` });
  // Short night → resting heart rate that morning.
  const heart = compare(days, short, d => valueOn(rhr, d));
  if (heart && Math.abs(heart.diff) >= 1.5) out.push({ id: 'sleep-rhr', tone: heart.diff > 0 ? 'bad' : 'good',
    text: `Your resting heart rate is ${k(heart.diff)} bpm ${heart.diff > 0 ? 'higher' : 'lower'} after short nights.`, detail: `${heart.a} short nights vs ${heart.b} others; a higher RHR means less recovered` });
  const recover = compare(days, short, d => valueOn(hrv, d));
  if (recover && Math.abs(recover.diff) >= 3) out.push({ id: 'sleep-hrv', tone: recover.diff < 0 ? 'bad' : 'good',
    text: `Your HRV is ${k(recover.diff)} ms ${recover.diff < 0 ? 'lower' : 'higher'} after short nights.`, detail: `${recover.a} short nights vs ${recover.b} others; higher HRV = better recovery` });
  // Weekends.
  const weekend = (d: string) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
  const wkFood = compare(days, weekend, d => full(d)?.kcal);
  if (wkFood && Math.abs(wkFood.diff) >= 150) out.push({ id: 'weekend-food', tone: wkFood.diff > 0 ? 'bad' : 'good',
    text: `You eat ${k(wkFood.diff)} kcal ${wkFood.diff > 0 ? 'more' : 'less'} a day on weekends.`, detail: `${wkFood.a} weekend days vs ${wkFood.b} weekdays${wkFood.diff > 0 ? `; that's about ${k((wkFood.diff * 2) / KCAL_PER_KG * 1000)} g a week` : ''}` });
  const wkSteps = compare(days, weekend, d => valueOn(steps, d));
  if (wkSteps && Math.abs(wkSteps.diff) >= 1500) out.push({ id: 'weekend-steps', tone: wkSteps.diff < 0 ? 'bad' : 'good',
    text: `You walk ${k(wkSteps.diff)} ${wkSteps.diff < 0 ? 'fewer' : 'more'} steps on weekends.`, detail: `${wkSteps.a} weekend days vs ${wkSteps.b} weekdays` });
  // Protein days → calories (protein keeps you fuller).
  if (proteinGoal) {
    const sated = compare(days, d => { const m = full(d); return m ? m.proteinG >= proteinGoal * 0.9 : null; }, d => full(d)?.kcal);
    if (sated && Math.abs(sated.diff) >= 100) out.push({ id: 'protein-food', tone: sated.diff < 0 ? 'good' : 'neutral',
      text: `On days you hit protein, you eat ${k(sated.diff)} kcal ${sated.diff < 0 ? 'less' : 'more'} overall.`, detail: `${sated.a} protein days vs ${sated.b} others` });
  }
  // Big dinners → next-morning weight change (needs weigh-ins on both days).
  const w = findTracker(data, 'weight');
  const big = compare(days, d => { const fd = data.fitnessDays?.[d]?.meals; const m = full(d); if (!fd?.length || !m) return null; return fd.filter(x => x.slot === 'dinner').reduce((s, x) => s + x.kcal, 0) / m.kcal >= 0.4; },
    d => { const a = valueOn(w, d), b = valueOn(w, addDays(d, 1)); return a != null && b != null ? b - a : undefined; });
  if (big && Math.abs(big.diff) >= 0.15) out.push({ id: 'dinner-weight', tone: big.diff > 0 ? 'bad' : 'neutral',
    text: `After big dinners (40%+ of the day), the next morning's weight is ${Math.abs(big.diff).toFixed(1)} kg ${big.diff > 0 ? 'higher' : 'lower'}.`, detail: `${big.a} big-dinner days vs ${big.b} others; mostly food and water weight, but a lighter dinner makes mornings kinder` });
  return out;
}

const longestRun = (days: string[], hit: (d: string) => boolean) => {
  let best = 0, run = 0, end = '';
  for (const d of [...days].sort()) { run = hit(d) ? run + 1 : 0; if (run > best) { best = run; end = d; } }
  return { best, end };
};
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function records(data: AppData, today: string): Record_[] {
  const days = window_(today, 365);
  const out: Record_[] = [];
  const best = (t: LogTracker | undefined, label: string, fmt: (n: number) => string, low = false) => {
    const logs = (t?.logs ?? []).filter(l => l.value > 0 && l.date < today);
    if (!logs.length) return;
    const top = logs.reduce((m, l) => ((low ? l.value < m.value : l.value > m.value) ? l : m));
    out.push({ id: label, label, value: fmt(top.value), date: fmtDate(top.date) });
  };
  best(findTracker(data, 'steps'), 'Most steps in a day', n => `${k(n)}`);
  const stepGoal = findTracker(data, 'steps')?.goal || 10000;
  const sRun = longestRun(days, d => (valueOn(findTracker(data, 'steps'), d) ?? 0) >= stepGoal);
  if (sRun.best >= 2) out.push({ id: 'steps-streak', label: `Longest ${k(stepGoal)}+ step streak`, value: `${sRun.best} days`, date: `ended ${fmtDate(sRun.end)}` });
  const pGoal = findTracker(data, 'protein')?.goal;
  if (pGoal) {
    const pRun = longestRun(days, d => dayMacros(data, d).proteinG >= pGoal * 0.9);
    if (pRun.best >= 2) out.push({ id: 'protein-streak', label: 'Longest protein streak', value: `${pRun.best} days`, date: `ended ${fmtDate(pRun.end)}` });
  }
  const goal = findTracker(data, 'intake')?.goal;
  const dRun = longestRun(days, d => { const m = dayMacros(data, d), b = dayBurn(data, d).total; return m.kcal >= (goal ? goal * 0.4 : 900) && b != null && m.kcal < b; });
  if (dRun.best >= 2) out.push({ id: 'deficit-streak', label: 'Longest calorie-deficit streak', value: `${dRun.best} days`, date: `ended ${fmtDate(dRun.end)}` });
  const s = trendSeries(findTracker(data, 'weight')?.logs ?? []);
  if (s.length) { const low = s.reduce((m, p) => (p.trend < m.trend ? p : m)); out.push({ id: 'lowest', label: 'Lowest trend weight', value: `${low.trend.toFixed(1)} kg`, date: fmtDate(low.date) }); }
  best(findTracker(data, 'restingHr'), 'Lowest resting heart rate', n => `${Math.round(n)} bpm`, true);
  best(metric(data, 'hrv'), 'Highest HRV', n => `${Math.round(n)} ms`);
  best(metric(data, 'azm'), 'Most Active Zone Minutes', n => `${Math.round(n)} min`);
  best(findTracker(data, 'sleep'), 'Longest sleep', hm);
  return out;
}

/** Goal date at a daily deficit, from the current trend weight. */
export function whatIf(trendKg: number, goalKg: number, deficit: number, today: string): { weeks: number; date: string; perWeek: number } | null {
  if (deficit <= 0 || goalKg >= trendKg) return null;
  const perWeek = (deficit * 7) / KCAL_PER_KG;
  const weeks = (trendKg - goalKg) / perWeek;
  return { weeks, date: addDays(today, Math.round(weeks * 7)), perWeek };
}

export type FoodInsight = { name: string; times: number; kcal: number; proteinShare: number; total: number };
/** Your foods over the last 60 days: protein per calorie, biggest calorie sources, and which meal runs over budget. */
export function foodInsights(data: AppData, today: string) {
  const days = window_(today, 60);
  const by = new Map<string, FoodInsight>();
  for (const d of days) for (const m of data.fitnessDays?.[d]?.meals ?? []) {
    if (m.name === 'Day total' || m.name === 'Earlier total' || m.kcal <= 0) continue;
    const key = m.name.trim().toLowerCase();
    const f = by.get(key) ?? { name: m.name, times: 0, kcal: 0, proteinShare: 0, total: 0 };
    f.times++; f.total += m.kcal; f.proteinShare += m.proteinG * 4;
    by.set(key, f);
  }
  const foods = [...by.values()].filter(f => f.times >= 2).map(f => ({ ...f, kcal: f.total / f.times, proteinShare: f.proteinShare / f.total }));
  const budgets = slotBudgets(findTracker(data, 'intake')?.goal);
  let over: { label: string; days: number; of: number } | null = null;
  if (budgets) for (const s of MEAL_SLOTS) {
    let n = 0, of = 0;
    for (const d of days) { const ms = (data.fitnessDays?.[d]?.meals ?? []).filter(m => m.slot === s.id); if (!ms.length) continue; of++; if (ms.reduce((a, m) => a + m.kcal, 0) > budgets[s.id]) n++; }
    if (of >= MIN_N && n / of >= 0.3 && (!over || n / of > over.days / over.of)) over = { label: s.label, days: n, of };
  }
  return {
    protein: [...foods].sort((a, b) => b.proteinShare - a.proteinShare).slice(0, 3),
    biggest: [...foods].sort((a, b) => b.total - a.total).slice(0, 3),
    over,
  };
}
