// Run: npx tsx src/lib/real-burn.check.ts
import assert from 'node:assert/strict';
import type { AppData, LogEntry } from './types';
import { addDays } from './fitness';
import { kcalFloor, realBurn, realScale, targetFor } from './real-burn';

const TODAY = '2026-11-26';
// 70 days losing exactly 0.5 kg/week while eating 2,000 kcal on logged days; Fitbit says 2,900 burned.
const weights: LogEntry[] = [], intake: LogEntry[] = [], burned: LogEntry[] = [];
for (let i = 70; i >= 1; i--) {
  const d = addDays(TODAY, -i);
  weights.push({ id: `w${i}`, date: d, value: 95 - ((70 - i) * 0.5) / 7 });
  if (i % 4 !== 0) intake.push({ id: `auto-intake-${d}`, date: d, value: 2000 });   // 3 of 4 days logged
  else intake.push({ id: `auto-intake-${d}`, date: d, value: 450 });                // a partial day: ignored
  burned.push({ id: `fitbit-burned-${d}`, date: d, value: 2900 });
}
const data = {
  fitnessProfile: { sex: 'male', birthYear: 1995, heightCm: 176 },
  logTrackers: [
    { id: 'w', name: 'Weight', unit: 'kg', logs: weights },
    { id: 'i', name: 'Daily Calorie Intake', unit: 'kcal', goal: 2200, logs: intake },
    { id: 'b', name: 'Calories Burned', unit: 'kcal', logs: burned, healthMetric: 'burned' },
  ],
} as unknown as AppData;

const r = realBurn(data, TODAY);
assert.ok(r.ok, 'enough data');
if (r.ok) {
  assert.equal(r.loggedDays, 21, 'partial days (under 40% of target) excluded');
  assert.equal(Math.round(r.avgIntake), 2000);
  assert.ok(Math.abs(r.ratePerWeek + 0.5) < 0.02, `rate ≈ −0.5 kg/week (got ${r.ratePerWeek})`);
  assert.ok(Math.abs(r.real - 2550) < 30, `real burn ≈ 2,000 + 550 (got ${Math.round(r.real)})`);
  assert.equal(r.fitbit?.days, 21);
  assert.equal(r.formula, null);
  assert.ok(Math.abs(r.gap! - 350) < 30, 'Fitbit ~350 kcal/day higher than your results');
}

// Per-day correction: Fitbit's 2,900 × scale = the real ~2,550.
const scale = realScale(r)!;
assert.ok(Math.abs(2900 * scale - (r.ok ? r.real : 0)) < 1, 'a Fitbit day scaled lands on the real burn');
assert.ok(scale > 0.85 && scale < 0.9);

// Not enough data: says what's missing.
const thin = realBurn({ ...data, logTrackers: data.logTrackers.map(t => (t.id === 'i' ? { ...t, logs: t.logs.slice(-5) } : t)) }, TODAY);
assert.ok(!thin.ok && /food logs on 14/.test(thin.need));
assert.equal(realScale(thin), null, 'no scale without enough data');
const noWeight = realBurn({ ...data, logTrackers: data.logTrackers.filter(t => t.id !== 'w') }, TODAY);
assert.ok(!noWeight.ok && /weigh-ins/.test(noWeight.need));

// A weigh-in is a reading, not a day in progress: today's counts. Three days running (today, yesterday, the day before) is 3.
const three = realBurn({ ...data, logTrackers: data.logTrackers.map(t => (t.id === 'w' ? { ...t, logs: [0, 1, 2].map(ago => ({ id: `t${ago}`, date: addDays(TODAY, -ago), value: 99 + ago * 0.1 })) } : t)) }, TODAY);
assert.ok(!three.ok && three.weighIns === 3 && /you have 3\)/.test(three.need), `today's weigh-in counts: ${!three.ok && three.need}`);
// Seven weigh-ins ending today are enough to unlock it (with the food logs above).
const seven = realBurn({ ...data, logTrackers: data.logTrackers.map(t => (t.id === 'w' ? { ...t, logs: [0, 1, 2, 3, 4, 5, 6].map(ago => ({ id: `s${ago}`, date: addDays(TODAY, -ago), value: 95 + ago * 0.07 })) } : t)) }, TODAY);
assert.ok(seven.ok, 'seven weigh-ins including today unlock it');

// Targets: rounded to 50, never below the floor.
assert.deepEqual(targetFor(2550, 0.5, 1500), { kcal: 2000, floored: false });
assert.deepEqual(targetFor(1800, 1, 1500), { kcal: 1500, floored: true });
assert.ok(kcalFloor(data, TODAY) >= 1500, 'men: at least 1,500 and resting burn');
console.log('real-burn: all checks passed');
