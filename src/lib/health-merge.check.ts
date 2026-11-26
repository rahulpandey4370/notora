// Run: npx tsx src/lib/health-merge.check.ts  — fails loudly if parsing/merging breaks.
import assert from 'node:assert/strict';
import { parseStepsRollup, parseSleep, parseRestingHr, combineDays, mergeHealthIntoTrackers, civilToYmd } from './health-merge';
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
console.log('health-merge: all checks passed');

// Same night from two sources overlaps: counted once (longer kept).
assert.deepEqual(parseSleep({ dataPoints: [
  { sleep: { interval: { startTime: '2026-03-04T17:00:00Z', endTime: '2026-03-05T01:00:00Z', civilEndTime: '2026-03-05T06:30:00' }, summary: { minutesAsleep: '400' } } },
  { sleep: { interval: { startTime: '2026-03-04T17:10:00Z', endTime: '2026-03-05T00:50:00Z', civilEndTime: '2026-03-05T06:20:00' }, summary: { minutesAsleep: '390' } } },
] }), [{ date: '2026-03-05', sleep_minutes: 400 }]);
console.log('health-merge: overlap check passed');
