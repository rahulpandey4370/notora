// "Your real burn": what your body actually burned per day, from the food you
// logged and how your trend weight moved (≈7,700 kcal per kg). Fitbit and the
// formula only estimate burn; this is measured against your own results.
// Pure; checked by `npx tsx src/lib/real-burn.check.ts`.
import type { AppData } from '@/lib/types';
import { addDays, bmr, dayBurn, dayMacros, findTracker, trendSeries, weeklyRate, weightOn } from '@/lib/fitness';

export const KCAL_PER_KG = 7700;
const WINDOW = 28;
const MIN_DAYS = 14;

export type RealBurn =
  | { ok: false; loggedDays: number; weighIns: number; need: string }
  | {
    ok: true; loggedDays: number; weighIns: number; avgIntake: number; ratePerWeek: number; real: number;
    /** The estimates on the same days: Fitbit's measured burn and the profile formula, apart. */
    fitbit: { avg: number; days: number } | null; formula: { avg: number; days: number } | null;
    /** Estimate − real, over the days that had an estimate (positive = estimates too high, or food under-logged). */
    gap: number | null;
  };

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * A day counts only if its log looks complete: at least 40% of the calorie
 * target (or 900 kcal without one). A day with just breakfast logged would
 * make the real burn look far too low.
 */
export function realBurn(data: AppData, today: string): RealBurn {
  const end = addDays(today, -1); // today isn't over
  const goal = findTracker(data, 'intake')?.goal;
  const floor = goal ? goal * 0.4 : 900;
  const days: { d: string; kcal: number }[] = [];
  for (let i = 0; i < WINDOW; i++) {
    const d = addDays(end, -i);
    const kcal = dayMacros(data, d).kcal;
    if (kcal >= floor) days.push({ d, kcal });
  }
  const series = trendSeries(findTracker(data, 'weight')?.logs ?? []);
  const weighIns = series.filter(p => p.weight !== undefined && p.date > addDays(end, -WINDOW) && p.date <= end).length;
  const rate = weeklyRate(series, end);
  if (days.length < MIN_DAYS || rate == null) {
    const need = [days.length < MIN_DAYS ? `full food logs on ${MIN_DAYS} of the last ${WINDOW} days (you have ${days.length})` : null,
      rate == null ? `7+ weigh-ins in 4 weeks (you have ${weighIns})` : null].filter(Boolean).join(' and ');
    return { ok: false, loggedDays: days.length, weighIns, need };
  }
  const avgIntake = mean(days.map(x => x.kcal));
  const real = avgIntake - (rate * KCAL_PER_KG) / 7;
  const fitbitDays: number[] = [], formulaDays: number[] = [];
  for (const { d } of days) {
    const b = dayBurn(data, d);
    if (b.total == null) continue;
    if (b.source === 'fitbit') fitbitDays.push(b.total); else formulaDays.push(b.total);
  }
  const est = [...fitbitDays, ...formulaDays];
  return {
    ok: true, loggedDays: days.length, weighIns, avgIntake, ratePerWeek: rate, real,
    fitbit: fitbitDays.length ? { avg: mean(fitbitDays), days: fitbitDays.length } : null,
    formula: formulaDays.length ? { avg: mean(formulaDays), days: formulaDays.length } : null,
    gap: est.length ? mean(est) - real : null,
  };
}

/** Lowest daily target the app will suggest: resting burn, and never under 1,500 (men) / 1,200 (women). */
export function kcalFloor(data: AppData, today: string): number {
  const p = data.fitnessProfile, kg = weightOn(data, today);
  const sexFloor = p?.sex === 'female' ? 1200 : 1500;
  return Math.max(sexFloor, p && kg ? Math.round(bmr(p, kg, today)) : 0);
}

/** Daily intake for a weekly loss (kg), from the real burn, rounded to 50 and kept above the floor. */
export function targetFor(real: number, kgPerWeek: number, floor: number): { kcal: number; floored: boolean } {
  const raw = real - (kgPerWeek * KCAL_PER_KG) / 7;
  const kcal = Math.round(Math.max(raw, floor) / 50) * 50;
  return { kcal, floored: raw < floor };
}
