// Run: npx tsx src/lib/journey.check.ts
import assert from 'node:assert/strict';
import type { AppData, LogEntry } from './types';
import { addDays } from './fitness';
import { journey } from './journey';

const TODAY = '2026-11-26';
const make = (kgOn: (i: number) => number, days = 90, goal = 85): AppData => {
  const logs: LogEntry[] = [];
  for (let i = days; i >= 0; i--) logs.push({ id: `w${i}`, date: addDays(TODAY, -i), value: kgOn(days - i) });
  return { logTrackers: [{ id: 'w', name: 'Weight', unit: 'kg', goal, logs }] } as unknown as AppData;
};

// Steady loss from 100 kg at 0.6 kg/week for 90 days.
const j = journey(make(d => 100 - (d * 0.6) / 7), TODAY)!;
assert.equal(j.start.kg, 100);
assert.ok(j.lost > 6 && j.lost < 8, `lost on the trend (lags the scale a little): ${j.lost}`);
assert.equal(j.status, 'losing');
assert.ok(j.pct! > 0.4 && j.pct! < 0.55);
assert.deepEqual(j.milestones.map(m => m.lost), [2.5, 5, 7.5, 10, 12.5, 15], 'every 2.5 kg to the 15 kg goal');
assert.equal(j.milestones.find(m => m.lost === 5)?.tag, '5%', '5% of 100 kg');
assert.equal(j.milestones.find(m => m.lost === 10)?.tag, '10%');
assert.equal(j.milestones.at(-1)?.tag, 'goal');
assert.ok(j.milestones[0].reached && j.milestones[1].reached, 'first two reached');
assert.equal(j.next?.lost, 7.5);
// Near-duplicates merge: 95.2 kg start → 5% is 4.8 kg (replaces the 5 kg step), 10% is 9.5 kg, goal 85 kg is 10.2 kg.
const odd = journey(make(d => 95.2 - (d * 0.3) / 7), TODAY)!;
assert.deepEqual(odd.milestones.map(m => `${m.lost}${m.tag ? ` ${m.tag}` : ''}`), ['2.5', '4.8 5%', '7.5', '9.5 10%', '10.2 goal'], 'the 5 and 10 kg steps give way to 5% and 10%; 10% and the goal are kept, 0.7 kg apart');
assert.ok(j.newLow, 'still making new lows');

// Stuck for the last month → plateau; regaining → regaining.
const flat = journey(make(d => (d < 50 ? 100 - (d * 0.6) / 7 : 100 - (50 * 0.6) / 7)), TODAY)!;
assert.equal(flat.status, 'plateau');
assert.ok(!flat.newLow);
const up = journey(make(d => (d < 50 ? 100 - (d * 0.6) / 7 : 100 - (50 * 0.6) / 7 + ((d - 50) * 0.5) / 7)), TODAY)!;
assert.equal(up.status, 'regaining');
assert.ok(up.change14! > 0);

assert.equal(journey({ logTrackers: [] } as unknown as AppData, TODAY), null, 'no weigh-ins');
console.log('journey: all checks passed');
