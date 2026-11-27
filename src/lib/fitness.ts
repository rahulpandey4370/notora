// Pure rules for the Logs page: trend weight, burn, day totals, and how a
// logged draft is saved. No React or server imports; checked by
// `npx tsx src/lib/fitness.check.ts`. Dates are 'yyyy-MM-dd' strings.
//
// Entry ids: `auto-intake|protein|burn-<date>` are derived here and may be
// rewritten; `fitbit-*` come from the Fitbit merge; anything else is a stored
// total that only the explicit rules below touch. A stored 0 is "no entry".
import type { Activity, AppData, FitnessDay, FitnessProfile, LogEntry, LogTracker, Meal, MealSlot } from '@/lib/types';

export const TRACKER = {
  weight: 'Weight', protein: 'Protein Intake', steps: 'Steps', intake: 'Daily Calorie Intake', burned: 'Calories Burned',
} as const;
const UNITS: Record<keyof typeof TRACKER, string> = { weight: 'kg', protein: 'g', steps: 'steps', intake: 'kcal', burned: 'kcal' };
export type TrackerKey = keyof typeof TRACKER | 'sleep' | 'restingHr';

const ALPHA = 0.1;            // trend-weight smoothing
const STEP_KCAL_PER_KG = 0.0005;

/** Hours → "7h 17m" from whole minutes (no 6-minute steps, never "7h 60m"). */
export const fmtSleep = (h: number) => {
  const m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60;
  return hh ? `${hh}h${mm ? ` ${mm}m` : ''}` : `${mm}m`;
};

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);

export function findTracker(data: AppData, key: TrackerKey): LogTracker | undefined {
  const ts = data.logTrackers ?? [];
  if (key === 'sleep' || key === 'restingHr') return ts.find(t => t.healthMetric === key);
  if (key === 'steps') return ts.find(t => t.healthMetric === 'steps') ?? ts.find(t => t.name === TRACKER.steps);
  return ts.find(t => t.name === TRACKER[key]);
}

const entryOn = (t: LogTracker | undefined, ymd: string) => t?.logs.find(l => l.date === ymd);

/** The day's value; undefined when missing or 0. */
export function valueOn(t: LogTracker | undefined, ymd: string): number | undefined {
  const v = entryOn(t, ymd)?.value;
  return v ? v : undefined;
}

const isAuto = (id: string) => id.startsWith('auto-');
/** A non-derived, non-zero value (an older AI or hand-typed total). */
const storedOn = (t: LogTracker | undefined, ymd: string) => {
  const e = entryOn(t, ymd);
  return e && !isAuto(e.id) && !e.id.startsWith('fitbit-') && e.value > 0 ? e.value : undefined;
};
/** Fitbit's measured burn for the day (fitbit-burned-<date>). */
const fitbitOn = (t: LogTracker | undefined, ymd: string) => {
  const e = entryOn(t, ymd);
  return e?.id.startsWith('fitbit-') && e.value > 0 ? e.value : undefined;
};

// ---------------------------------------------------------------- weight

/** `reseed`: first weigh-in after a long gap, where the trend restarts. */
export type TrendPoint = { date: string; weight?: number; trend: number; reseed?: boolean };
const RESEED_GAP_DAYS = 14;

/**
 * One point per day from the first to the last weigh-in; short gaps carry the
 * trend forward. After a gap of 14+ days the trend restarts at the new weigh-in,
 * otherwise the old weight would leak in as a fake weekly loss/gain.
 */
export function trendSeries(logs: LogEntry[]): TrendPoint[] {
  const byDate = new Map<string, number>();
  for (const l of [...logs].sort((a, b) => a.date.localeCompare(b.date))) {
    if (l.value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(l.date) && addDays(l.date, 0) === l.date) byDate.set(l.date, l.value);
  }
  const dates = [...byDate.keys()];
  if (!dates.length) return [];
  const out: TrendPoint[] = [];
  let trend = byDate.get(dates[0])!;
  let lastWeighIn = dates[0];
  for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDays(d, 1)) {
    const w = byDate.get(d);
    let reseed = false;
    if (w !== undefined) {
      if (daysBetween(lastWeighIn, d) >= RESEED_GAP_DAYS) { trend = w; reseed = true; }
      else trend += ALPHA * (w - trend);
      lastWeighIn = d;
    }
    out.push(reseed ? { date: d, weight: w, trend, reseed } : { date: d, weight: w, trend });
  }
  return out;
}

/** kg/week from a least-squares fit of the last 28 days of trend (since any restart); null with < 7 weigh-ins there. */
export function weeklyRate(series: TrendPoint[], today: string): number | null {
  const restart = [...series].reverse().find(p => p.reseed && p.date <= today)?.date;
  const from = restart && restart > addDays(today, -27) ? restart : addDays(today, -27);
  const pts = series.filter(p => p.date >= from && p.date <= today);
  if (pts.filter(p => p.weight !== undefined).length < 7) return null;
  const xs = pts.map(p => daysBetween(from, p.date));
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = pts.reduce((s, p) => s + p.trend, 0) / pts.length;
  let num = 0, den = 0;
  pts.forEach((p, i) => { num += (xs[i] - mx) * (p.trend - my); den += (xs[i] - mx) ** 2; });
  return den ? (num / den) * 7 : null;
}

/** Date the goal is reached at this rate; null unless heading toward it at ≥ 0.05 kg/week. */
export function goalEta(trend: number, rate: number | null, goal: number | undefined, today: string): string | null {
  if (goal == null || rate == null || Math.abs(rate) < 0.05) return null;
  const diff = goal - trend;
  if (diff === 0) return today;
  if (Math.sign(diff) !== Math.sign(rate)) return null;
  return addDays(today, Math.round((diff / rate) * 7));
}

/** That day's weigh-in, else the trend on or before it (else the earliest trend). */
export function weightOn(data: AppData, ymd: string): number | undefined {
  const series = trendSeries(findTracker(data, 'weight')?.logs ?? []);
  if (!series.length) return undefined;
  const exact = series.find(p => p.date === ymd);
  if (exact?.weight !== undefined) return exact.weight;
  const before = series.filter(p => p.date <= ymd);
  return (before[before.length - 1] ?? series[0]).trend;
}

// ---------------------------------------------------------------- burn

/** Mifflin-St Jeor. */
export function bmr(p: FitnessProfile, kg: number, ymd: string): number {
  const age = Number(ymd.slice(0, 4)) - p.birthYear;
  return 10 * kg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161);
}

export type BurnInfo = {
  total: number | null; base: number | null; source: 'stored' | 'fitbit' | 'computed' | 'none';
  activities: { activity: Activity; counted: boolean }[];
};

export function dayBurn(data: AppData, ymd: string): BurnInfo {
  const day = data.fitnessDays?.[ymd];
  const steps = valueOn(findTracker(data, 'steps'), ymd);
  let base: number | null = null;
  let source: BurnInfo['source'] = 'none';
  const stored = day?.burnBase ?? storedOn(findTracker(data, 'burned'), ymd);
  const fitbit = fitbitOn(findTracker(data, 'burned'), ymd);
  if (stored != null) { base = stored; source = 'stored'; }
  else if (fitbit != null) { base = fitbit; source = 'fitbit'; }
  else if (data.fitnessProfile) {
    const kg = weightOn(data, ymd);
    if (kg) { base = bmr(data.fitnessProfile, kg, ymd) + (steps ?? 0) * STEP_KCAL_PER_KG * kg; source = 'computed'; }
  }
  // Fitbit's burn already has every workout in it; otherwise walks and runs are in the step count when there is one.
  const activities = (day?.activities ?? []).map(activity => ({ activity, counted: source !== 'fitbit' && !(activity.stepBased && steps != null) }));
  const extra = activities.reduce((s, a) => s + (a.counted ? a.activity.kcal : 0), 0);
  return { total: base == null ? null : base + extra, base, source, activities };
}

export type Macros = { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
const r1 = (n: number) => Math.round(n * 10) / 10;

/** The day's food totals from its meals (summed, then rounded once); an older stored total when there are no meals. */
export function dayMacros(data: AppData, ymd: string): Macros {
  const meals = data.fitnessDays?.[ymd]?.meals ?? [];
  if (!meals.length) {
    const i = dayIntake(data, ymd);
    return { kcal: Math.round(i.kcal ?? 0), proteinG: r1(i.proteinG ?? 0), carbsG: 0, fatG: 0, fiberG: 0 };
  }
  const sum = (k: 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG') => meals.reduce((t, m) => t + (m[k] ?? 0), 0);
  return { kcal: Math.round(sum('kcal')), proteinG: r1(sum('proteinG')), carbsG: r1(sum('carbsG')), fatG: r1(sum('fatG')), fiberG: r1(sum('fiberG')) };
}

export function dayIntake(data: AppData, ymd: string): { kcal?: number; proteinG?: number } {
  return { kcal: valueOn(findTracker(data, 'intake'), ymd), proteinG: valueOn(findTracker(data, 'protein'), ymd) };
}

// ---------------------------------------------------------------- meal slots

/** The day's five sections and each one's share of the calorie target. */
export const MEAL_SLOTS: { id: MealSlot; label: string; share: number }[] = [
  { id: 'breakfast', label: 'Breakfast', share: 0.25 },
  { id: 'morningSnack', label: 'Morning snack', share: 0.10 },
  { id: 'lunch', label: 'Lunch', share: 0.30 },
  { id: 'eveningSnack', label: 'Evening snack', share: 0.10 },
  { id: 'dinner', label: 'Dinner', share: 0.25 },
];
const SLOT_IDS = new Set<string>(MEAL_SLOTS.map(x => x.id));

/** kcal budget per section, rounded to 10; null without a calorie target. */
export function slotBudgets(kcalGoal: number | undefined): Record<MealSlot, number> | null {
  if (!kcalGoal) return null;
  return Object.fromEntries(MEAL_SLOTS.map(x => [x.id, Math.round((kcalGoal * x.share) / 10) * 10])) as Record<MealSlot, number>;
}

/** The section for something eaten now: breakfast till 10:30, then snack, lunch from 12:30, snack from 15:30, dinner from 18:30. */
export function slotForTime(hour: number, minute = 0): MealSlot {
  const t = hour * 60 + minute;
  if (t >= 4 * 60 && t < 10 * 60 + 30) return 'breakfast';
  if (t >= 10 * 60 + 30 && t < 12 * 60 + 30) return 'morningSnack';
  if (t >= 12 * 60 + 30 && t < 15 * 60 + 30) return 'lunch';
  if (t >= 15 * 60 + 30 && t < 18 * 60 + 30) return 'eveningSnack';
  return 'dinner';
}

export function mealsBySlot(meals: Meal[]): Record<MealSlot | 'other', Meal[]> {
  const out = { breakfast: [], morningSnack: [], lunch: [], eveningSnack: [], dinner: [], other: [] } as Record<MealSlot | 'other', Meal[]>;
  for (const m of meals) out[m.slot && SLOT_IDS.has(m.slot) ? m.slot : 'other'].push(m);
  return out;
}

export type QuickMeal = Omit<Meal, 'id'>;
const isTotal = (m: Meal) => m.name === 'Day total' || m.name === 'Earlier total';
const strip = ({ id: _id, ...m }: Meal): QuickMeal => m;

/**
 * One-tap re-log for a meal section: what you had in it the day before, then
 * your most-logged items there in the 30 days before (2+ times, most often
 * first, then most recent), without repeating yesterday's.
 */
export function quickPicks(data: AppData, ymd: string, slot: MealSlot): { yesterday: QuickMeal[]; usual: QuickMeal[] } {
  const inSlot = (d: string) => (data.fitnessDays?.[d]?.meals ?? []).filter(m => m.slot === slot && !isTotal(m));
  const yesterday = inSlot(addDays(ymd, -1)).map(strip);
  const key = (m: { name: string }) => m.name.trim().toLowerCase();
  const seen = new Set(yesterday.map(key));
  const counts = new Map<string, { meal: QuickMeal; n: number; last: string }>();
  for (let i = 2; i <= 31; i++) {
    const d = addDays(ymd, -i);
    for (const m of inSlot(d)) {
      const k = key(m);
      if (seen.has(k)) continue;
      const c = counts.get(k);
      if (c) c.n++; else counts.set(k, { meal: strip(m), n: 1, last: d });
    }
  }
  const usual = [...counts.values()].filter(c => c.n >= 2).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 3).map(c => c.meal);
  return { yesterday, usual };
}

/** A meal's calories, never below what its macros add up to (protein and carbs 4 kcal/g, fat 9). */
export const flooredKcal = (m: Pick<Meal, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>) =>
  Math.max(m.kcal || 0, Math.round((m.proteinG || 0) * 4 + (m.carbsG || 0) * 4 + (m.fatG || 0) * 9));

// ---------------------------------------------------------------- saving

export type FitnessDraft = {
  date: string;
  meals: Omit<Meal, 'id'>[];
  activities: Omit<Activity, 'id'>[];
  values: { trackerId: string; value: number }[];
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** What a typed value will overwrite, for the draft card; null when nothing. */
export function describeValueChange(data: AppData, draft: FitnessDraft, v: FitnessDraft['values'][number]): string | null {
  const t = data.logTrackers.find(x => x.id === v.trackerId);
  if (!t) return null;
  const parts: string[] = [];
  const day = data.fitnessDays?.[draft.date];
  if (t === findTracker(data, 'burned')) {
    const b = dayBurn(data, draft.date);
    if (day?.activities.length) parts.push("replaces the day's burn, including logged workouts");
    else if (b.total != null) parts.push(b.source === 'computed' ? `replaces your estimated ${fmt(b.total)} kcal` : b.source === 'fitbit' ? `replaces Fitbit's ${fmt(b.total)} kcal for this day` : `replaces ${fmt(b.total)} ${t.unit}`);
  } else {
    const current = valueOn(t, draft.date);
    if (current != null) parts.push(`replaces ${fmt(current)} ${t.unit}`);
    const isFood = t === findTracker(data, 'intake') || t === findTracker(data, 'protein');
    if (isFood && (day?.meals.length ?? 0) > 1) parts.push("merges the day's meals into one total");
  }
  if (t === findTracker(data, 'steps') && (t.healthMetric === 'steps' || entryOn(t, draft.date)?.id.startsWith('fitbit-'))) {
    parts.push("Fitbit won't update this day");
  }
  return parts.length ? parts.join(' · ') : null;
}

type Work = { data: AppData; day: FitnessDay; date: string; newId: () => string };

function begin(data: AppData, date: string, newId: () => string): Work {
  const out: AppData = {
    ...data,
    logTrackers: data.logTrackers.map(t => ({ ...t, logs: [...t.logs] })),
    fitnessDays: { ...(data.fitnessDays ?? {}) },
  };
  const prev = out.fitnessDays![date];
  const day: FitnessDay = { meals: [...(prev?.meals ?? [])], activities: [...(prev?.activities ?? [])], ...(prev?.burnBase != null ? { burnBase: prev.burnBase } : {}) };
  out.fitnessDays![date] = day;
  return { data: out, day, date, newId };
}

function tracker(w: Work, key: keyof typeof TRACKER): LogTracker {
  const found = findTracker(w.data, key);
  if (found) return found;
  const t: LogTracker = { id: w.newId(), name: TRACKER[key], unit: UNITS[key], logs: [] };
  w.data.logTrackers.push(t);
  return t;
}

/** Replace the day's entry. Notes on the entry being replaced are kept (older AI and manual entries carry them). */
function setEntry(t: LogTracker, date: string, entry: LogEntry | null) {
  const prev = t.logs.find(l => l.date === date);
  t.logs = t.logs.filter(l => l.date !== date);
  if (entry) t.logs.push({ ...(prev?.notes ? { notes: prev.notes } : {}), ...(prev?.activityNotes ? { activityNotes: prev.activityNotes } : {}), ...entry });
  t.logs.sort((a, b) => a.date.localeCompare(b.date));
}

function writeFood(w: Work) {
  const kcal = w.day.meals.reduce((s, m) => s + m.kcal, 0);
  const protein = w.day.meals.reduce((s, m) => s + m.proteinG, 0);
  setEntry(tracker(w, 'intake'), w.date, kcal > 0 ? { id: `auto-intake-${w.date}`, date: w.date, value: Math.round(kcal) } : null);
  setEntry(tracker(w, 'protein'), w.date, protein > 0 ? { id: `auto-protein-${w.date}`, date: w.date, value: Math.round(protein) } : null);
}

function writeBurn(w: Work) {
  const t = tracker(w, 'burned');
  if (!w.day.activities.length && w.day.burnBase == null) {
    // Nothing logged by hand any more: drop the derived entry, the page computes it live.
    if (entryOn(t, w.date)?.id.startsWith('auto-')) setEntry(t, w.date, null);
    return;
  }
  if (w.day.burnBase == null && fitbitOn(t, w.date) != null) return; // Fitbit's burn stays the day's total
  const total = dayBurn(w.data, w.date).total;
  setEntry(t, w.date, total == null ? null : { id: `auto-burn-${w.date}`, date: w.date, value: Math.round(total) });
}

function finish(w: Work): AppData {
  const { day, data, date } = w;
  if (!day.meals.length && !day.activities.length && day.burnBase == null) delete data.fitnessDays![date];
  return data;
}

/** Save a confirmed draft: values replace, meals and activities add (see the spec's rules). */
export function applyDraft(data: AppData, draft: FitnessDraft, newId: () => string): AppData {
  const w = begin(data, draft.date, newId);
  const { day, date } = w;
  let food = false, burn = false;
  const intakeT = () => findTracker(w.data, 'intake');
  const proteinT = () => findTracker(w.data, 'protein');
  const mealSum = (k: 'kcal' | 'proteinG') => day.meals.reduce((s, m) => s + m[k], 0);

  for (const v of draft.values) {
    const t = w.data.logTrackers.find(x => x.id === v.trackerId);
    if (!t || !Number.isFinite(v.value)) continue;
    if (t === intakeT() || t === proteinT()) {
      const otherKcal = day.meals.length ? mealSum('kcal') : valueOn(intakeT(), date) ?? 0;
      const otherProtein = day.meals.length ? mealSum('proteinG') : valueOn(proteinT(), date) ?? 0;
      const isIntake = t === intakeT();
      day.meals = [{ id: newId(), name: 'Day total', kcal: isIntake ? v.value : otherKcal, proteinG: isIntake ? otherProtein : v.value }];
      food = true;
    } else if (t === findTracker(w.data, 'burned')) {
      day.burnBase = v.value;
      day.activities = [];
      burn = true;
    } else {
      // Steps, weight and anything else: a hand-typed value for the day.
      setEntry(t, date, { id: newId(), date, value: v.value });
    }
  }

  if (draft.meals.length) {
    if (!day.meals.length) {
      const kcal = valueOn(intakeT(), date), protein = valueOn(proteinT(), date);
      if (kcal != null || protein != null) day.meals.push({ id: newId(), name: 'Earlier total', kcal: kcal ?? 0, proteinG: protein ?? 0 });
    }
    day.meals.push(...draft.meals.map(m => ({ ...m, kcal: flooredKcal(m), id: newId() })));
    food = true;
  }

  if (draft.activities.length) {
    if (day.burnBase == null) {
      // The stored total becomes the base; writeBurn then replaces its entry (keeping its notes).
      const stored = storedOn(findTracker(w.data, 'burned'), date);
      if (stored != null) day.burnBase = stored;
    }
    day.activities.push(...draft.activities.map(a => ({ ...a, id: newId() })));
    burn = true;
  }

  if (food) writeFood(w);
  if (burn) writeBurn(w);
  return finish(w);
}

export type LogEdit = { id: string; delete?: boolean; patch?: Partial<Pick<Meal, 'name' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'slot'>> };

/** Change or delete already-logged meals in one save (edits from the chat). Ids and order are kept; calories floored at the macros. */
export function applyLogEdits(data: AppData, ymd: string, edits: LogEdit[], newId: () => string): AppData {
  const w = begin(data, ymd, newId);
  const byId = new Map(edits.map(e => [e.id, e]));
  w.day.meals = w.day.meals.flatMap(m => {
    const e = byId.get(m.id);
    if (!e) return [m];
    if (e.delete) return [];
    const next = { ...m, ...pick(e.patch ?? {}, ['name', 'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'slot']) };
    return [{ ...next, kcal: flooredKcal(next) }];
  });
  writeFood(w);
  return finish(w);
}

/** Edit or delete (patch null) one logged meal or activity, then recompute the day's totals. */
export function editDayItem(
  data: AppData, ymd: string, kind: 'meal' | 'activity', id: string, patch: Partial<Meal & Activity> | null, newId: () => string,
): AppData {
  const w = begin(data, ymd, newId);
  if (kind === 'meal') {
    w.day.meals = patch === null ? w.day.meals.filter(m => m.id !== id)
      : w.day.meals.map(m => {
        if (m.id !== id) return m;
        const next = { ...m, ...pick(patch, ['name', 'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'slot', 'notes']) };
        return { ...next, kcal: flooredKcal(next) };
      });
    writeFood(w);
  } else {
    w.day.activities = patch === null ? w.day.activities.filter(a => a.id !== id)
      : w.day.activities.map(a => (a.id === id ? { ...a, ...pick(patch, ['name', 'minutes', 'kcal', 'stepBased', 'notes']) } : a));
    writeBurn(w);
  }
  return finish(w);
}

/** Undo a typed day burn total: the day goes back to its estimate (plus any workouts). */
export function clearBurnBase(data: AppData, ymd: string, newId: () => string): AppData {
  const w = begin(data, ymd, newId);
  delete w.day.burnBase;
  writeBurn(w);
  return finish(w);
}

/**
 * Make an AI draft safe to save: a date that isn't a real day within the last
 * year (or is in the future) falls back to `dayYmd`; negative numbers clamp to
 * 0; zero/invalid tracker values are dropped (a 0 would wipe that day's entry).
 */
export function sanitizeDraft(draft: FitnessDraft, todayYmd: string, dayYmd: string): FitnessDraft {
  const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`))
    && addDays(d, 0) === d && d <= todayYmd && d >= addDays(todayYmd, -366);
  const pos = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
  return {
    date: ok(draft.date) ? draft.date : dayYmd,
    meals: draft.meals.map(m => {
      const { slot, grams, ...rest } = m;
      const proteinG = pos(m.proteinG), carbsG = pos(m.carbsG), fatG = pos(m.fatG);
      // Under-counting hurts a weight-loss log most: calories are never below what the macros add up to.
      const kcal = Math.max(pos(m.kcal), Math.round(proteinG * 4 + carbsG * 4 + fatG * 9));
      return { ...rest, kcal, proteinG, carbsG, fatG, fiberG: pos(m.fiberG), ...(slot && SLOT_IDS.has(slot) ? { slot } : {}), ...(pos(grams) ? { grams: Math.round(pos(grams)) } : {}) };
    }),
    activities: draft.activities.map(a => ({ ...a, minutes: pos(a.minutes), kcal: pos(a.kcal), stepBased: !!a.stepBased })),
    values: draft.values.filter(v => pos(v.value) > 0),
  };
}

function pick<T extends object>(o: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

// ---------------------------------------------------------------- targets & streak

export type Targets = Partial<Record<'weight' | 'protein' | 'steps' | 'intake', number | undefined>>;

/** Save the profile and goals (stored as the matching trackers' `goal`); creates missing trackers. */
export function setTargets(data: AppData, profile: FitnessProfile, goals: Targets, newId: () => string): AppData {
  const out: AppData = { ...data, fitnessProfile: profile, logTrackers: data.logTrackers.map(t => ({ ...t })) };
  for (const key of Object.keys(goals) as (keyof Targets)[]) {
    const goal = goals[key];
    let t = findTracker(out, key);
    if (!t) {
      if (goal == null) continue;
      t = { id: newId(), name: TRACKER[key], unit: UNITS[key], logs: [] };
      out.logTrackers.push(t);
    }
    t.goal = goal;
  }
  return out;
}

export function suggestTargets(data: AppData, today: string): { steps: number; proteinG: number | null; kcal: number | null } {
  const kg = weightOn(data, today);
  const burns: number[] = [];
  for (let i = 0; i < 90 && burns.length < 14; i++) {
    const total = dayBurn(data, addDays(today, -i)).total;
    if (total != null) burns.push(total);
  }
  const mean = burns.length ? burns.reduce((s, b) => s + b, 0) / burns.length : null;
  return {
    steps: 10000,
    proteinG: kg ? Math.round((1.6 * kg) / 5) * 5 : null,
    // Never below resting burn, and never under 1,500 (men) / 1,200 (women).
    kcal: mean == null ? null : Math.round(Math.max(mean - 500, data.fitnessProfile?.sex === 'female' ? 1200 : 1500, data.fitnessProfile && kg ? bmr(data.fitnessProfile, kg, today) : 0) / 50) * 50,
  };
}

/** Consecutive days with something logged by the user (Fitbit syncs don't count). */
/** Consecutive days at or over the step goal (Fitbit or typed); today counts once it's reached. */
export function stepsStreak(data: AppData, today: string): number {
  const t = findTracker(data, 'steps');
  if (!t) return 0;
  const goal = t.goal || 10000;
  const hit = (d: string) => (valueOn(t, d) ?? 0) >= goal;
  let d = hit(today) ? today : addDays(today, -1);
  let n = 0;
  while (hit(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** Consecutive days you logged something yourself (Fitbit's automatic entries don't count). */
export function loggingStreak(data: AppData, today: string): number {
  const dates = new Set((data.logTrackers ?? []).flatMap(t => t.logs.filter(l => !l.id.startsWith('fitbit-')).map(l => l.date)));
  let d = dates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
