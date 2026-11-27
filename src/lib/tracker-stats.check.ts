// Run: npx tsx src/lib/tracker-stats.check.ts
import assert from 'node:assert/strict';
import { stats, type Point } from './tracker-stats';

// 2026-11-01 is a Sunday. Steps-like, goal 10k, higher is better; last day (today) not logged yet.
const pts: Point[] = [8000, 11000, undefined, 10000, 12000, 10500, undefined].map((value, i) => ({ date: `2026-11-0${i + 1}`, value }));
const s = stats(pts, 10000, 'up');
assert.equal(s.n, 5);
assert.equal(s.avg, 10300);
assert.equal(s.total, 51500);
assert.deepEqual(s.high, { date: '2026-11-05', value: 12000 });
assert.deepEqual(s.low, { date: '2026-11-01', value: 8000 });
assert.equal(s.goalDays, 4);
assert.equal(s.streak, 3, 'empty today is skipped; the gap on the 3rd ends the streak');
assert.ok(s.perWeek! > 0, 'rising');
assert.equal(s.weekday[0], 8000, 'Sunday');
assert.equal(s.weekday[2], null, 'Tuesday has no value');
assert.equal(s.rolling[1], 9500);

// Lower is better (resting HR): on goal means at or under.
const hr = stats([{ date: '2026-11-01', value: 62 }, { date: '2026-11-02', value: 58 }, { date: '2026-11-03', value: 60 }], 60, 'down');
assert.equal(hr.goalDays, 2);
assert.equal(hr.streak, 2);
assert.equal(hr.perWeek, null, 'too few values for a trend');

// No goal, no data.
const none = stats([{ date: '2026-11-01' }], undefined, 'up');
assert.equal(none.avg, null);
assert.equal(none.goalDays, null);
assert.equal(none.streak, null);
console.log('tracker-stats: all checks passed');
