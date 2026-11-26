// Pure helpers for the Google Health (Fitbit) integration: parsing API
// responses and folding daily rows into the user's log trackers. No server
// imports, so `npx tsx src/lib/health-merge.check.ts` can exercise them.
import type { AppData, LogTracker } from '@/lib/types';

export type HealthMetric = 'steps' | 'sleep' | 'restingHr';
export type HealthDay = { date: string; steps?: number | null; sleep_minutes?: number | null; resting_hr?: number | null };

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The API returns civil dates/times either as strings ("2026-03-04" or
 * "2026-03-04T05:00:00") or as {year,month,day} / {date:{year,month,day}}
 * objects depending on the field; accept all of them.
 */
export function civilToYmd(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
  if (typeof v === 'object') {
    const o = v as any;
    const d = o.date ?? o;
    if (d?.year && d?.month && d?.day) return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
  }
  return null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** POST .../steps/dataPoints:dailyRollUp → per-day step totals. */
export function parseStepsRollup(json: any): HealthDay[] {
  return (json?.rollupDataPoints ?? []).flatMap((p: any) => {
    const date = civilToYmd(p.civilStartTime) ?? civilToYmd(p.startTime);
    const steps = num(p.steps?.countSum);
    return date && steps !== null ? [{ date, steps }] : [];
  });
}

/** GET .../daily-resting-heart-rate/dataPoints → per-day resting HR. */
export function parseRestingHr(json: any): HealthDay[] {
  return (json?.dataPoints ?? []).flatMap((p: any) => {
    const date = civilToYmd(p.dailyRestingHeartRate?.date);
    const bpm = num(p.dailyRestingHeartRate?.beatsPerMinute);
    return date && bpm !== null ? [{ date, resting_hr: bpm }] : [];
  });
}

/**
 * GET .../sleep/dataPoints → minutes asleep, credited to the day you woke up.
 * Several sessions ending the same day (a nap) are summed.
 */
export function parseSleep(json: any): HealthDay[] {
  type S = { date: string; minutes: number; start: number; end: number };
  const sessions: S[] = [];
  for (const p of json?.dataPoints ?? []) {
    const s = p.sleep;
    if (!s) continue;
    const date = civilToYmd(s.interval?.civilEndTime) ?? localDateFromPhysical(s.interval?.endTime, s.interval?.endUtcOffset);
    const minutes = num(s.summary?.minutesAsleep);
    if (!date || minutes === null) continue;
    sessions.push({ date, minutes, start: Date.parse(s.interval?.startTime) || 0, end: Date.parse(s.interval?.endTime) || 0 });
  }
  // The same night recorded twice (band + phone) shows up as overlapping
  // sessions: keep the longer one. Separate sessions (a nap) are summed.
  sessions.sort((a, b) => a.start - b.start);
  const kept: S[] = [];
  for (const s of sessions) {
    const prev = kept[kept.length - 1];
    if (prev && s.start && prev.end && s.start < prev.end) {
      if (s.minutes > prev.minutes) kept[kept.length - 1] = s;
    } else kept.push(s);
  }
  const byDay = new Map<string, number>();
  for (const s of kept) byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.minutes);
  return [...byDay].map(([date, sleep_minutes]) => ({ date, sleep_minutes }));
}

/** "2026-03-04T23:10:00Z" + "19800s" → local civil date. */
function localDateFromPhysical(time?: string, offset?: string): string | null {
  if (!time) return null;
  const ms = Date.parse(time);
  if (Number.isNaN(ms)) return null;
  const off = offset ? Number(offset.replace(/s$/, '')) || 0 : 0;
  return new Date(ms + off * 1000).toISOString().slice(0, 10);
}

/** Combine per-metric rows into one row per date. */
export function combineDays(...lists: HealthDay[][]): HealthDay[] {
  const map = new Map<string, HealthDay>();
  for (const row of lists.flat()) map.set(row.date, { ...map.get(row.date), ...row });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const TRACKERS: Record<HealthMetric, { name: string; unit: string; goal: number; aliases: string[]; value: (d: HealthDay) => number | null | undefined }> = {
  steps: { name: 'Steps', unit: 'steps', goal: 10000, aliases: ['steps', 'step count'], value: d => d.steps },
  sleep: { name: 'Sleep', unit: 'hours', goal: 8, aliases: ['sleep'], value: d => (d.sleep_minutes == null ? null : Math.round((d.sleep_minutes / 60) * 10) / 10) },
  restingHr: { name: 'Resting heart rate', unit: 'bpm', goal: 60, aliases: ['resting heart rate', 'resting hr', 'rhr'], value: d => d.resting_hr },
};

export const fitbitEntryId = (metric: HealthMetric, date: string) => `fitbit-${metric}-${date}`;

/**
 * Fold synced days into log trackers. Reuses a tracker already tagged with the
 * metric, else one whose name matches (your existing "Steps" tracker), else
 * creates it. Fitbit entries have deterministic ids so re-merging is
 * idempotent; a day you logged by hand keeps your value.
 */
export function mergeHealthIntoTrackers(data: AppData, days: HealthDay[]): AppData {
  if (!days.length) return data;
  let trackers: LogTracker[] = [...(data.logTrackers ?? [])];

  for (const metric of Object.keys(TRACKERS) as HealthMetric[]) {
    const spec = TRACKERS[metric];
    const values = days.flatMap(d => {
      const v = spec.value(d);
      return v == null ? [] : [{ date: d.date, value: v }];
    });
    if (!values.length) continue;

    let idx = trackers.findIndex(t => t.healthMetric === metric);
    if (idx === -1) idx = trackers.findIndex(t => spec.aliases.includes(t.name.trim().toLowerCase()));
    const tracker: LogTracker = idx === -1
      ? { id: `fitbit-${metric}`, name: spec.name, unit: spec.unit, goal: spec.goal, logs: [], healthMetric: metric }
      : { ...trackers[idx], healthMetric: metric, logs: [...trackers[idx].logs] };

    for (const { date, value } of values) {
      const id = fitbitEntryId(metric, date);
      const at = tracker.logs.findIndex(l => l.date === date);
      if (at === -1) tracker.logs.push({ id, date, value });
      else if (tracker.logs[at].id === id) tracker.logs[at] = { ...tracker.logs[at], value };
      // else: a manual entry for that day — leave it.
    }
    tracker.logs.sort((a, b) => a.date.localeCompare(b.date));
    if (idx === -1) trackers = [...trackers, tracker];
    else trackers[idx] = tracker;
  }
  return { ...data, logTrackers: trackers };
}
