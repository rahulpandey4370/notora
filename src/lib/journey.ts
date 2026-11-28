// The weight-loss journey: start → now → goal on the smoothed trend (not the
// noisy daily weight), milestones every 2.5 kg, new lows, and whether you're
// losing, stuck or regaining. Pure; checked by `npx tsx src/lib/journey.check.ts`.
import type { AppData } from '@/lib/types';
import { addDays, findTracker, trendSeries, weeklyRate } from '@/lib/fitness';

export type Milestone = { kg: number; lost: number; reached?: string; tag?: '5%' | '10%' | 'goal' };
export type Journey = {
  start: { date: string; kg: number }; current: { date: string; kg: number }; goal?: number;
  lost: number; toGo: number | null; pct: number | null; days: number;
  milestones: Milestone[]; next?: Milestone; lowest: { date: string; kg: number };
  /** The trend is 0.1 kg+ below anything before the last 3 days (worth a celebration). */
  newLow: boolean;
  status: 'losing' | 'plateau' | 'regaining' | 'early'; ratePerWeek: number | null;
  /** Trend change over the last 14 days (kg). */
  change14: number | null;
};

const STEP = 2.5;
export const JOURNEY_DEFAULT = '90d';

/** The first day the journey counts, from the setting ('all', '30d'…, or a date); null = from the first weigh-in. */
export function journeyStartDate(from: string | undefined, today: string): string | null {
  const f = from ?? JOURNEY_DEFAULT;
  const window = /^(\d+)d$/.exec(f);
  if (window) return addDays(today, -Number(window[1]));
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export function journey(data: AppData, today: string): Journey | null {
  const weight = findTracker(data, 'weight');
  const all = trendSeries(weight?.logs ?? []);
  if (all.length < 2) return null;
  // Measure from the chosen start, so progress is about now rather than a weigh-in from long ago.
  // Too little inside the window (fewer than 2 points) falls back to everything.
  const from = journeyStartDate(data.journeyFrom, today);
  const inWindow = from ? all.filter(p => p.date >= from) : all;
  const s = inWindow.length >= 2 ? inWindow : all;
  const first = s.find(p => p.weight !== undefined)!;
  // From the very first weigh-in the start is that reading; mid-history it is the smoothed trend that day.
  const start = s[0] === all[0] ? { date: first.date, kg: first.weight! } : { date: s[0].date, kg: r1(s[0].trend) };
  const last = s[s.length - 1];
  const current = { date: last.date, kg: last.trend };
  const goal = weight?.goal;
  const losing = goal == null || goal < start.kg;
  const lost = start.kg - current.kg;
  const span = goal != null ? start.kg - goal : null;
  const pct = span && span > 0 ? Math.max(0, Math.min(1, lost / span)) : null;

  // Milestones: every 2.5 kg toward the goal (or 4 of them with no goal); 5% and 10% of starting weight called out.
  const total = span && span > 0 ? span : STEP * 4;
  const marks = new Map<number, Milestone>();
  for (let x = STEP; x < total - 0.05; x += STEP) marks.set(r1(x), { kg: r1(start.kg - x), lost: r1(x) });
  // 5% / 10% and the goal: tag the nearest 2.5 kg step when one is within 0.6 kg, so the path doesn't fill with near-duplicates.
  const place = (x: number, m: Milestone) => {
    const near = [...marks.keys()].find(key => Math.abs(key - x) <= 0.6 && marks.get(key)!.tag !== 'goal');
    if (near != null) marks.delete(near);
    marks.set(r1(x), m);
  };
  for (const [p, tag] of [[0.05, '5%'], [0.1, '10%']] as const) {
    const x = r1(start.kg * p);
    if (x < total - 0.6) place(x, { kg: r1(start.kg - x), lost: x, tag });
  }
  if (span && span > 0) place(span, { kg: goal!, lost: r1(span), tag: 'goal' });
  const milestones = [...marks.values()].sort((a, b) => a.lost - b.lost).map(m => {
    const hit = losing ? s.find(p => p.trend <= m.kg + 1e-9) : undefined;
    return hit ? { ...m, reached: hit.date } : m;
  });

  const lowest = all.reduce((m, p) => (p.trend < m.trend ? p : m), all[0]); // all time, not just the window
  const rate = weeklyRate(s, today);
  const at14 = s.find(p => p.date === addDays(last.date, -14));
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start.date}T00:00:00Z`)) / 86400_000);
  return {
    start, current, goal, lost: r1(lost), toGo: goal != null ? r1(Math.max(0, current.kg - goal)) : null, pct, days,
    milestones, next: milestones.find(m => !m.reached), lowest: { date: lowest.date, kg: lowest.trend },
    // A real new low: 0.1 kg under the lowest EVER before the last 3 days (the smoothed trend inches down forever on a plateau).
    // Judged on all weigh-ins, not the journey window: "lightest yet" must stay true after an old regain.
    newLow: all.length > 7 && last.date >= addDays(today, -3) && last.trend <= Math.min(...all.filter(p => p.date < addDays(last.date, -3)).map(p => p.trend)) - 0.1,
    status: rate == null ? 'early' : rate < -0.1 ? 'losing' : rate > 0.1 ? 'regaining' : 'plateau',
    ratePerWeek: rate, change14: at14 ? r1(last.trend - at14.trend) : null,
  };
}
