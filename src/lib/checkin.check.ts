// Run: npx tsx src/lib/checkin.check.ts
import assert from 'node:assert/strict';
import type { AppData, LogEntry } from './types';
import { addDays } from './fitness';
import { checkinPush, weeklyCheckin } from './checkin';

const TODAY = '2026-11-29'; // a Sunday: the week is Sun 22 – Sat 28
const series = (f: (i: number) => number | null) => {
  const out: LogEntry[] = [];
  for (let i = 1; i <= 21; i++) { const v = f(i); if (v != null) out.push({ id: `x${i}`, date: addDays(TODAY, -i), value: v }); }
  return out;
};
const data = {
  logTrackers: [
    { id: 'i', name: 'Daily Calorie Intake', unit: 'kcal', goal: 2000, logs: series(i => (i === 3 ? 2600 : i === 5 ? 300 : 1900)) },
    { id: 'p', name: 'Protein Intake', unit: 'g', goal: 150, logs: series(i => (i % 2 ? 100 : 145)) },
    { id: 's', name: 'Steps', unit: 'steps', goal: 10000, healthMetric: 'steps', logs: series(i => (i <= 7 && i % 3 === 0 ? 11000 : 8000)) },
    { id: 'z', name: 'Sleep', unit: 'hours', goal: 8, healthMetric: 'sleep', logs: series(() => 7.5) },
    { id: 'w', name: 'Weight', unit: 'kg', logs: series(i => 90 + i * 0.05) },
  ],
} as unknown as AppData;

const c = weeklyCheckin(data, TODAY)!;
assert.equal(c.from, '2026-11-22');
assert.equal(c.to, '2026-11-28', 'ends yesterday: today is unfinished');
const area = (id: string) => c.areas.find(a => a.id === id)!;
assert.equal(area('food').detail, '6 of 7 days fully logged', 'the 300 kcal day is a partial log');
assert.equal(area('food').points, 1);
assert.equal(area('calories').detail, '5 of 6 logged days at or under 2,000 kcal');
assert.equal(area('calories').points, 2);
assert.equal(area('protein').points, 1, '145 g counts as near 150 (within 10%)');
assert.equal(area('steps').points, 0, '2 of 7 days at 10k');
assert.equal(area('sleep').points, 1, '7.5 h vs an 8 h goal');
assert.equal(c.score, 5, '5 of 10 points');
assert.equal(c.focus?.area, 'steps', 'weakest habit');
assert.ok(c.trendChange! < 0, 'trend went down over the week');
assert.match(checkinPush(c).title, /5\/10/);
assert.match(checkinPush(c).body, /Focus this week: steps/);

assert.equal(weeklyCheckin({ logTrackers: [] } as unknown as AppData, TODAY), null, 'nothing logged');
console.log('checkin: all checks passed');
