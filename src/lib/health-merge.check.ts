// Run: npx tsx src/lib/health-merge.check.ts  — fails loudly if parsing/merging breaks.
import assert from 'node:assert/strict';
import { parseStepsRollup, parseSleep, parseRestingHr, combineDays, mergeHealthIntoTrackers, civilToYmd, parseWeight, parseRollup, parseDailyList } from './health-merge';
import type { AppData } from './types';

// Shapes per developers.google.com/health docs examples (values are strings).
const steps = parseStepsRollup({ rollupDataPoints: [
  { civilStartTime: { date: { year: 2026, month: 3, day: 4 }, time: {} }, steps: { countSum: '8430' } },
  { civilStartTime: '2026-03-05T00:00:00', steps: { countSum: '120' } },
] });
assert.deepEqual(steps, [{ date: '2026-03-04', steps: 8430 }, { date: '2026-03-05', steps: 120 }]);

const sleep = parseSleep({ dataPoints: [
  { sleep: { interval: { civilEndTime: '2026-03-05T06:40:00' }, summary: { minutesAsleep: '407' } } },
  { sleep: { interval: { endTime: '2026-03-05T09:00:00Z', endUtcOffset: '19800s' }, summary: { minutesAsleep: '30' } } }, // nap, same local day
] });
assert.deepEqual(sleep, [{ date: '2026-03-05', sleep_minutes: 437 }]);

assert.deepEqual(parseRestingHr({ dataPoints: [{ dailyRestingHeartRate: { date: { year: 2026, month: 3, day: 5 }, beatsPerMinute: '58' } }] }),
  [{ date: '2026-03-05', resting_hr: 58 }]);
assert.equal(civilToYmd('garbage'), null);

const days = combineDays(steps, sleep);
const base = { tasks: [], noteBoards: [], userStats: { xp: 0 }, savedLinks: [], journalEntries: [],
  logTrackers: [{ id: 'mine', name: 'Steps', unit: 'steps', logs: [{ id: 'manual', date: '2026-03-04', value: 5000 }] }] } as AppData;

const merged = mergeHealthIntoTrackers(base, days);
const stepsT = merged.logTrackers.find(t => t.id === 'mine')!;
assert.equal(stepsT.healthMetric, 'steps', 'existing "Steps" tracker is reused');
assert.equal(stepsT.logs.find(l => l.date === '2026-03-04')!.value, 5000, 'manual entry wins');
assert.equal(stepsT.logs.find(l => l.date === '2026-03-05')!.value, 120);
const sleepT = merged.logTrackers.find(t => t.healthMetric === 'sleep')!;
assert.equal(sleepT.logs[0].value, 7.3, 'sleep in hours, 1 decimal');

// Idempotent, and a later sync updates Fitbit's own entry.
const again = mergeHealthIntoTrackers(merged, [{ date: '2026-03-05', steps: 9000 }]);
assert.equal(again.logTrackers.length, merged.logTrackers.length);
assert.equal(again.logTrackers.find(t => t.id === 'mine')!.logs.find(l => l.date === '2026-03-05')!.value, 9000);
// Shapes below are what the Google Health API returned for a real account.
const cs = (day: number) => ({ date: { year: 2026, month: 11, day }, time: {} });
assert.deepEqual(parseWeight({ dataPoints: [
  { weight: { sampleTime: { physicalTime: '2026-10-14T12:47:00Z', civilTime: { date: { year: 2026, month: 10, day: 14 }, time: { hours: 18 } } }, weightGrams: 97800 } },
  { weight: { sampleTime: { physicalTime: '2026-10-14T02:00:00Z', civilTime: { date: { year: 2026, month: 10, day: 14 }, time: { hours: 7 } } }, weightGrams: 98350 } },
  { weight: { sampleTime: { physicalTime: '2026-10-10T02:00:00Z', utcOffset: '19800s' }, weightGrams: 98123 } },
] }), [{ date: '2026-10-10', weight_kg: 98.1 }, { date: '2026-10-14', weight_kg: 97.8 }], 'kg to 1 decimal, the latest weigh-in of a day wins');

assert.deepEqual(parseRollup({ rollupDataPoints: [{ civilStartTime: cs(26), totalCalories: { kcalSum: 3495.7467 } }] }, 'calories'), [{ date: '2026-11-26', kcal_total: 3496 }]);
assert.deepEqual(parseRollup({ rollupDataPoints: [{ civilStartTime: cs(26), distance: { millimetersSum: '6998800' } }] }, 'distance'), [{ date: '2026-11-26', distance_km: 7 }]);
assert.deepEqual(parseRollup({ rollupDataPoints: [{ civilStartTime: cs(26), activeZoneMinutes: { sumInCardioHeartZone: '40', sumInPeakHeartZone: '0', sumInFatBurnHeartZone: '71' } }] }, 'azm'), [{ date: '2026-11-26', azm: 111 }]);
assert.deepEqual(parseDailyList({ dataPoints: [{ dailyHeartRateVariability: { date: { year: 2026, month: 11, day: 25 }, averageHeartRateVariabilityMilliseconds: 41.15 } }] }, 'hrv'), [{ date: '2026-11-25', hrv_ms: 41.2 }]);
assert.deepEqual(parseDailyList({ dataPoints: [{ dailyOxygenSaturation: { date: { year: 2026, month: 11, day: 25 }, averagePercentage: 95.2 } }] }, 'spo2'), [{ date: '2026-11-25', spo2: 95.2 }]);
assert.deepEqual(parseDailyList({ dataPoints: [{ dailyRespiratoryRate: { date: { year: 2026, month: 11, day: 25 }, breathsPerMinute: 18.4 } }] }, 'breaths'), [{ date: '2026-11-25', breaths: 18.4 }]);

// Weight goes into the existing "Weight" tracker; a hand-typed weigh-in that day wins.
{
  const d0 = { ...base, logTrackers: [
    { id: 'w', name: 'Weight', unit: 'kg', logs: [{ id: 'typed', date: '2026-10-14', value: 97.5 }] },
    { id: 'b', name: 'Calories Burned', unit: 'kcal', logs: [{ id: 'auto-burn-2026-11-25', date: '2026-11-25', value: 2400 }, { id: 'auto-burn-2026-11-24', date: '2026-11-24', value: 2600 }, { id: 'typed-burn', date: '2026-11-23', value: 2000 }] },
  ], fitnessDays: { '2026-11-24': { meals: [], activities: [], burnBase: 2500 } } } as AppData;
  const m = mergeHealthIntoTrackers(d0, [
    { date: '2026-10-10', weight_kg: 98.1 }, { date: '2026-10-14', weight_kg: 97.8 },
    { date: '2026-11-25', kcal_total: 3100 }, { date: '2026-11-24', kcal_total: 3000 }, { date: '2026-11-23', kcal_total: 2900 },
    { date: '2026-11-25', hrv_ms: 41.2, spo2: 95.2, breaths: 18.4, distance_km: 7, azm: 111 },
  ]);
  const w = m.logTrackers.find(t => t.id === 'w')!;
  assert.equal(w.healthMetric, 'weight');
  assert.deepEqual(w.logs.map(l => [l.date, l.value]), [['2026-10-10', 98.1], ['2026-10-14', 97.5]]);
  const b = m.logTrackers.find(t => t.id === 'b')!;
  assert.equal(b.healthMetric, 'burned');
  const burnOn = (date: string) => b.logs.find(l => l.date === date)!;
  assert.equal(burnOn('2026-11-25').value, 3100, "Fitbit's measured burn replaces the app's own estimate");
  assert.equal(burnOn('2026-11-24').value, 2600, 'a typed day burn total is left alone');
  assert.equal(burnOn('2026-11-23').value, 2000, 'a hand-typed burn entry wins');
  for (const name of ['HRV', 'Blood oxygen', 'Breathing rate', 'Distance', 'Active Zone Minutes']) assert.ok(m.logTrackers.some(t => t.name === name), `${name} tracker created`);
}
console.log('health-merge: all checks passed');

// Same night from two sources overlaps: counted once (longer kept).
assert.deepEqual(parseSleep({ dataPoints: [
  { sleep: { interval: { startTime: '2026-03-04T17:00:00Z', endTime: '2026-03-05T01:00:00Z', civilEndTime: '2026-03-05T06:30:00' }, summary: { minutesAsleep: '400' } } },
  { sleep: { interval: { startTime: '2026-03-04T17:10:00Z', endTime: '2026-03-05T00:50:00Z', civilEndTime: '2026-03-05T06:20:00' }, summary: { minutesAsleep: '390' } } },
] }), [{ date: '2026-03-05', sleep_minutes: 400 }]);
console.log('health-merge: overlap check passed');
