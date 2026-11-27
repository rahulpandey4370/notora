// Run: npx tsx src/lib/week.check.ts — weekly task keys round-trip to the Monday of their week.
import assert from 'node:assert/strict';
import { addDays, format, startOfWeek } from 'date-fns';
import { weekKey, weekStart } from './week';

const ymd = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd') : null);
const mondayOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });

// Named cases: early January, weeks 1–9, late December (28–31 Dec fall in next year's week 1).
const cases: [string, string, string][] = [
  // date, key written, Monday read back
  ['2026-01-01', '2026-1', '2025-12-29'],
  ['2026-01-03', '2026-1', '2025-12-29'],
  ['2026-01-05', '2026-2', '2026-01-05'],
  ['2026-02-04', '2026-6', '2026-02-02'],
  ['2026-02-27', '2026-9', '2026-02-23'],
  ['2026-11-15', '2026-46', '2026-11-09'], // a Sunday files with the week it ends
  ['2026-11-18', '2026-47', '2026-11-16'],
  ['2026-11-22', '2026-47', '2026-11-16'],
  ['2026-12-28', '2027-1', '2026-12-28'],
  ['2026-12-31', '2027-1', '2026-12-28'],
  ['2027-01-01', '2027-1', '2026-12-28'],
  ['2025-12-31', '2026-1', '2025-12-29'],
];
for (const [day, key, monday] of cases) {
  const d = new Date(`${day}T12:00:00`);
  assert.equal(weekKey(d), key, `key for ${day}`);
  assert.equal(ymd(weekStart(key)), monday, `Monday for ${day}`);
}

// Every day 2024–2028 (Sundays included) reads back as the Monday of its own Mon–Sun week.
for (let d = new Date(2024, 0, 1); d < new Date(2029, 0, 1); d = addDays(d, 1))
  assert.equal(ymd(weekStart(weekKey(d))), ymd(mondayOf(d)), `round-trip ${ymd(d)}`);

// "2026-47": week 1 of 2026 is Sun 28 Dec 2025 – Sat 3 Jan 2026, so week 47 is Sun 15 – Sat 21 Nov 2026; its Monday is 16 Nov.
assert.equal(ymd(weekStart('2026-47')), '2026-11-16');
assert.equal(ymd(weekStart('2026-05')), ymd(weekStart('2026-5')), 'zero-padded week reads the same');

for (const bad of ['', 'garbage', '2026', '2026-0', '2026-54', '2026-W47', '2026-47-1', '26-4', '2026-123', '2026-53'])
  assert.equal(weekStart(bad), null, `garbage: ${bad}`);

console.log('week.check: ok');
