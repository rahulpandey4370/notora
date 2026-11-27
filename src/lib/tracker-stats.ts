// Numbers behind the tracker detail sheet on the Logs page. Pure; checked by
// `npx tsx src/lib/tracker-stats.check.ts`. Dates are 'yyyy-MM-dd'.
import type { AppData, LogTracker } from '@/lib/types';
import { addDays, dayBurn, findTracker, valueOn } from '@/lib/fitness';

export type Direction = 'up' | 'down' | 'neutral';
export type Point = { date: string; value?: number };

/** A tracker's value for the day as the Logs page shows it: Calories Burned is worked out (profile, steps, workouts) unless Fitbit measured it. */
export function trackerValueOn(data: AppData, t: LogTracker, ymd: string): number | undefined {
  return t === findTracker(data, 'burned') ? dayBurn(data, ymd).total ?? undefined : valueOn(t, ymd);
}

/** Trackers the page fills itself (from meals, or worked out): no hand entries here. */
export const isDerived = (data: AppData, t: LogTracker) =>
  t === findTracker(data, 'burned') || t === findTracker(data, 'intake') || t === findTracker(data, 'protein');

/** Whether a higher value is better. Weight follows its goal (goal below the latest → losing). */
export function direction(data: AppData, t: LogTracker, latest?: number): Direction {
  if (t.healthMetric === 'restingHr' || t === findTracker(data, 'intake')) return 'down';
  if (t.healthMetric === 'breaths') return 'neutral';
  if (t.healthMetric === 'weight' || t === findTracker(data, 'weight')) return t.goal != null && latest != null ? (t.goal < latest ? 'down' : 'up') : 'neutral';
  return 'up';
}

/** `days` days ending on `end`, oldest first. */
export const series = (data: AppData, t: LogTracker, end: string, days: number): Point[] =>
  Array.from({ length: days }, (_, i) => { const date = addDays(end, i - days + 1); return { date, value: trackerValueOn(data, t, date) }; });

export const meets = (v: number, goal: number, dir: Direction) => (dir === 'down' ? v <= goal : v >= goal);

export type Stats = {
  n: number; avg: number | null; total: number; high?: Required<Point>; low?: Required<Point>;
  /** Days on goal, of the `n` logged. */
  goalDays: number | null;
  /** Goal days in a row up to the end (an empty last day, e.g. today so far, is skipped). */
  streak: number | null;
  /** Least-squares change per week; null under 4 values. */
  perWeek: number | null;
  /** Trailing 7-day average at each point. */
  rolling: (number | null)[];
  /** Average by weekday, Sunday first. */
  weekday: (number | null)[];
};

export function stats(points: Point[], goal: number | undefined, dir: Direction): Stats {
  const have = points.map((p, i) => ({ ...p, i })).filter((p): p is Required<Point> & { i: number } => p.value != null);
  const vals = have.map(p => p.value);
  const total = vals.reduce((a, b) => a + b, 0);
  const avg = vals.length ? total / vals.length : null;
  const high = have.reduce<typeof have[number] | undefined>((m, p) => (!m || p.value > m.value ? p : m), undefined);
  const low = have.reduce<typeof have[number] | undefined>((m, p) => (!m || p.value < m.value ? p : m), undefined);

  let streak: number | null = null;
  if (goal != null) {
    streak = 0;
    let i = points.length - 1;
    if (i >= 0 && points[i].value == null) i--;
    for (; i >= 0; i--) { const v = points[i].value; if (v == null || !meets(v, goal, dir)) break; streak++; }
  }

  let perWeek: number | null = null;
  if (have.length >= 4) {
    const n = have.length, sx = have.reduce((a, p) => a + p.i, 0), sy = total;
    const sxy = have.reduce((a, p) => a + p.i * p.value, 0), sxx = have.reduce((a, p) => a + p.i * p.i, 0);
    const den = n * sxx - sx * sx;
    perWeek = den ? ((n * sxy - sx * sy) / den) * 7 : null;
  }

  const rolling = points.map((_, i) => {
    const w = points.slice(Math.max(0, i - 6), i + 1).map(p => p.value).filter((v): v is number => v != null);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
  });

  const byDay: number[][] = Array.from({ length: 7 }, () => []);
  for (const p of have) byDay[new Date(`${p.date}T00:00:00Z`).getUTCDay()].push(p.value);
  const weekday = byDay.map(xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null));

  return {
    n: vals.length, avg, total, goalDays: goal == null ? null : vals.filter(v => meets(v, goal, dir)).length, streak, perWeek, rolling, weekday,
    ...(high ? { high: { date: high.date, value: high.value } } : {}), ...(low ? { low: { date: low.date, value: low.value } } : {}),
  };
}
