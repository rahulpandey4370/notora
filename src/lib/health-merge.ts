// Pure helpers for the Google Health (Fitbit) integration: parsing API
// responses and folding daily rows into the user's log trackers. No server
// imports, so `npx tsx src/lib/health-merge.check.ts` can exercise them.
import type { AppData, FitbitWorkout, LogTracker } from '@/lib/types';

export type HealthMetric = 'steps' | 'sleep' | 'restingHr' | 'weight' | 'burned' | 'distance' | 'azm' | 'hrv' | 'spo2' | 'breaths';
export type HealthDay = {
  date: string; steps?: number | null; sleep_minutes?: number | null; resting_hr?: number | null;
  weight_kg?: number | null; kcal_total?: number | null; distance_km?: number | null; azm?: number | null;
  hrv_ms?: number | null; spo2?: number | null; breaths?: number | null;
  workouts?: FitbitWorkout[] | null;
};
/** The newer health_daily columns (supabase/notora-v3-health.sql); syncing still works without them. */
export const EXTRA_HEALTH_COLUMNS = ['weight_kg', 'kcal_total', 'distance_km', 'azm', 'hrv_ms', 'spo2', 'breaths', 'workouts'] as const;

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

const round1 = (n: number) => Math.round(n * 10) / 10;

/** GET .../weight/dataPoints → kg per day (1 decimal); the latest weigh-in of a day wins. */
export function parseWeight(json: any): HealthDay[] {
  const byDay = new Map<string, { at: number; kg: number }>();
  for (const p of json?.dataPoints ?? []) {
    const t = p.weight?.sampleTime;
    const grams = num(p.weight?.weightGrams);
    const date = civilToYmd(t?.civilTime) ?? localDateFromPhysical(t?.physicalTime, t?.utcOffset);
    if (!date || grams === null || grams <= 0) continue;
    const at = Date.parse(t?.physicalTime) || 0;
    const prev = byDay.get(date);
    if (!prev || at >= prev.at) byDay.set(date, { at, kg: round1(grams / 1000) });
  }
  return [...byDay].map(([date, v]) => ({ date, weight_kg: v.kg })).sort((a, b) => a.date.localeCompare(b.date));
}

/** POST .../dataPoints:dailyRollUp for total-calories, distance and active-zone-minutes. */
export function parseRollup(json: any, kind: 'calories' | 'distance' | 'azm'): HealthDay[] {
  return (json?.rollupDataPoints ?? []).flatMap((p: any) => {
    const date = civilToYmd(p.civilStartTime);
    if (!date) return [];
    if (kind === 'calories') { const v = num(p.totalCalories?.kcalSum); return v === null ? [] : [{ date, kcal_total: Math.round(v) }]; }
    if (kind === 'distance') { const v = num(p.distance?.millimetersSum); return v === null ? [] : [{ date, distance_km: Math.round(v / 10_000) / 100 }]; }
    // Each zone sum is already in Active Zone Minutes (cardio and peak minutes count double).
    const z = p.activeZoneMinutes;
    const parts = [z?.sumInFatBurnHeartZone, z?.sumInCardioHeartZone, z?.sumInPeakHeartZone].map(num);
    return parts.every(x => x === null) ? [] : [{ date, azm: parts.reduce<number>((s, x) => s + (x ?? 0), 0) }];
  });
}

/** GET daily summary lists: daily-heart-rate-variability, daily-oxygen-saturation, daily-respiratory-rate. */
export function parseDailyList(json: any, kind: 'hrv' | 'spo2' | 'breaths'): HealthDay[] {
  const pick = {
    hrv: (p: any) => [p.dailyHeartRateVariability, p.dailyHeartRateVariability?.averageHeartRateVariabilityMilliseconds, 'hrv_ms'],
    spo2: (p: any) => [p.dailyOxygenSaturation, p.dailyOxygenSaturation?.averagePercentage, 'spo2'],
    breaths: (p: any) => [p.dailyRespiratoryRate, p.dailyRespiratoryRate?.breathsPerMinute, 'breaths'],
  }[kind];
  return (json?.dataPoints ?? []).flatMap((p: any) => {
    const [rec, raw, key] = pick(p);
    const date = civilToYmd(rec?.date), v = num(raw);
    return date && v !== null ? [{ date, [key]: round1(v) }] : [];
  });
}

/** GET .../exercise/dataPoints → each day's Fitbit workouts, by local start time. */
export function parseExercises(json: any): HealthDay[] {
  const byDay = new Map<string, FitbitWorkout[]>();
  for (const p of json?.dataPoints ?? []) {
    const e = p.exercise;
    const startTime: string | undefined = e?.interval?.startTime;
    const offset = e?.interval?.startUtcOffset;
    const date = localDateFromPhysical(startTime, offset);
    if (!e || !startTime || !date) continue;
    const local = new Date(Date.parse(startTime) + (Number(String(offset ?? '0').replace(/s$/, '')) || 0) * 1000).toISOString();
    const secs = num(String(e.activeDuration ?? '').replace(/s$/, '')) ?? 0;
    const m = e.metricsSummary ?? {};
    const km = num(m.distanceMillimeters), hr = num(m.averageHeartRateBeatsPerMinute);
    const w: FitbitWorkout = {
      id: startTime, name: String(e.displayName || e.exerciseType || 'Workout'), type: String(e.exerciseType ?? ''),
      minutes: Math.round(secs / 60), kcal: Math.round(num(m.caloriesKcal) ?? 0), start: local.slice(11, 16),
      ...(km ? { distanceKm: Math.round(km / 10_000) / 100 } : {}), ...(hr ? { avgHr: hr } : {}),
    };
    byDay.set(date, [...(byDay.get(date) ?? []), w]);
  }
  return [...byDay].map(([date, workouts]) => ({ date, workouts: workouts.sort((a, b) => a.start.localeCompare(b.start)) }));
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

const TRACKERS: Record<HealthMetric, { name: string; unit: string; goal?: number; aliases: string[]; value: (d: HealthDay) => number | null | undefined }> = {
  steps: { name: 'Steps', unit: 'steps', goal: 10000, aliases: ['steps', 'step count'], value: d => d.steps },
  sleep: { name: 'Sleep', unit: 'hours', goal: 8, aliases: ['sleep'], value: d => (d.sleep_minutes == null ? null : d.sleep_minutes / 60) }, // exact: Fitbit's minutes, unrounded,
  restingHr: { name: 'Resting heart rate', unit: 'bpm', goal: 60, aliases: ['resting heart rate', 'resting hr', 'rhr'], value: d => d.resting_hr },
  weight: { name: 'Weight', unit: 'kg', aliases: ['weight', 'body weight'], value: d => d.weight_kg },
  burned: { name: 'Calories Burned', unit: 'kcal', aliases: ['calories burned', 'calories burnt'], value: d => d.kcal_total },
  distance: { name: 'Distance', unit: 'km', aliases: ['distance'], value: d => d.distance_km },
  azm: { name: 'Active Zone Minutes', unit: 'min', goal: 22, aliases: ['active zone minutes', 'azm'], value: d => d.azm },
  hrv: { name: 'HRV', unit: 'ms', aliases: ['hrv', 'heart rate variability'], value: d => d.hrv_ms },
  spo2: { name: 'Blood oxygen', unit: '%', aliases: ['blood oxygen', 'spo2', 'oxygen saturation'], value: d => d.spo2 },
  breaths: { name: 'Breathing rate', unit: 'br/min', aliases: ['breathing rate', 'respiratory rate'], value: d => d.breaths },
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
      ? { id: `fitbit-${metric}`, name: spec.name, unit: spec.unit, ...(spec.goal ? { goal: spec.goal } : {}), logs: [], healthMetric: metric }
      : { ...trackers[idx], healthMetric: metric, logs: [...trackers[idx].logs] };

    for (const { date, value } of values) {
      const id = fitbitEntryId(metric, date);
      const at = tracker.logs.findIndex(l => l.date === date);
      // The app's own derived burn (auto-burn) gives way to Fitbit's measured one, unless you typed a day total.
      const replaceable = (e: LogTracker['logs'][number]) => e.id === id || (metric === 'burned' && e.id.startsWith('auto-') && data.fitnessDays?.[date]?.burnBase == null);
      if (at === -1) tracker.logs.push({ id, date, value });
      else if (replaceable(tracker.logs[at])) tracker.logs[at] = { ...tracker.logs[at], id, value };
      // else: a manual entry for that day — leave it.
    }
    tracker.logs.sort((a, b) => a.date.localeCompare(b.date));
    if (idx === -1) trackers = [...trackers, tracker];
    else trackers[idx] = tracker;
  }
  // Fitbit workouts: each synced day's list replaces what was there (only days the sync covered).
  const workouts = days.filter(d => Array.isArray(d.workouts));
  const fitbitWorkouts = workouts.length
    ? { ...data.fitbitWorkouts, ...Object.fromEntries(workouts.map(d => [d.date, d.workouts!])) }
    : data.fitbitWorkouts;
  return { ...data, logTrackers: trackers, ...(fitbitWorkouts ? { fitbitWorkouts } : {}) };
}
