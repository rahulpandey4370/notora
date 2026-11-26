// Assert checks for the fitness rules: `npx tsx src/lib/fitness.check.ts`
import assert from 'node:assert/strict';
import type { AppData, LogTracker } from '@/lib/types';
import {
  applyDraft, bmr, dayBurn, dayIntake, describeValueChange, editDayItem, goalEta, loggingStreak,
  clearBurnBase, sanitizeDraft, setTargets, suggestTargets, trendSeries, weeklyRate, stepsStreak, type TrendPoint,
} from './fitness';

const TODAY = '2026-11-26';
let n = 0;
const id = () => `id${++n}`;
const ymdOffset = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const tracker = (name: string, unit: string, logs: [string, number, string?][], extra: Partial<LogTracker> = {}): LogTracker =>
  ({ id: name, name, unit, logs: logs.map(([date, value, lid]) => ({ id: lid ?? `m-${name}-${date}`, date, value })), ...extra });
const base = (trackers: LogTracker[], extra: Partial<AppData> = {}): AppData => ({
  tasks: [], noteBoards: [], userStats: { xp: 0 }, savedLinks: [], logTrackers: trackers, journalEntries: [], ...extra,
});
const profile = { sex: 'male' as const, birthYear: 1996, heightCm: 175 };
const entry = (d: AppData, name: string, date: string) => d.logTrackers.find(t => t.name === name)?.logs.find(l => l.date === date);
const close = (a: number | null | undefined, b: number, eps = 0.01) => assert.ok(a != null && Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

// trendSeries: one point per day, gaps carried forward, EMA α = 0.1
{
  const s = trendSeries([{ id: 'a', date: '2026-01-01', value: 100 }, { id: 'b', date: '2026-01-03', value: 99 }]);
  assert.equal(s.length, 3);
  assert.equal(s[1].weight, undefined);
  assert.equal(s[1].trend, s[0].trend);
  close(s[2].trend, 100 + 0.1 * (99 - 100));
}

// rateNeedsData: fewer than 7 weigh-ins in the last 28 days → null
{
  const logs = [0, 5, 10, 15, 20].map(i => ({ id: `w${i}`, date: ymdOffset(TODAY, -i), value: 90 }));
  assert.equal(weeklyRate(trendSeries(logs), TODAY), null);
  const series: TrendPoint[] = Array.from({ length: 28 }, (_, i) => ({ date: ymdOffset(TODAY, i - 27), weight: 95 - 0.1 * i, trend: 95 - 0.1 * i }));
  close(weeklyRate(series, TODAY), -0.7, 0.05);
}

// goalEta
assert.equal(goalEta(93, -0.5, 85, TODAY), ymdOffset(TODAY, 16 * 7));
assert.equal(goalEta(93, 0.2, 85, TODAY), null);
assert.equal(goalEta(93, -0.03, 85, TODAY), null);
assert.equal(goalEta(93, -0.5, undefined, TODAY), null);

// bmr: male, 30, 175 cm, 75 kg
close(bmr({ sex: 'male', birthYear: 1996, heightCm: 175 }, 75, TODAY), 1698.75);

// noProfileBurnNull
{
  const b = dayBurn(base([tracker('Weight', 'kg', [[TODAY, 80]])]), TODAY);
  assert.equal(b.total, null);
  assert.equal(b.source, 'none');
}

// computedBurn: bmr + steps × 0.0005 × kg
const fit = base([tracker('Weight', 'kg', [[TODAY, 80]]), tracker('Steps', 'steps', [[TODAY, 10000]])], { fitnessProfile: profile });
const bmr80 = bmr(profile, 80, TODAY);
{
  const b = dayBurn(fit, TODAY);
  assert.equal(b.source, 'computed');
  close(b.total, bmr80 + 400);
}

// stepBasedNotCounted
{
  const walk = { date: TODAY, meals: [], activities: [{ name: 'Walk', minutes: 40, kcal: 200, stepBased: true }], values: [] };
  const withSteps = applyDraft(fit, walk, id);
  close(dayBurn(withSteps, TODAY).total, bmr80 + 400);
  assert.equal(dayBurn(withSteps, TODAY).activities[0].counted, false);
  const noSteps = applyDraft(base([tracker('Weight', 'kg', [[TODAY, 80]])], { fitnessProfile: profile }), walk, id);
  close(dayBurn(noSteps, TODAY).total, bmr80 + 200);
}

// storedBurnBecomesBase + idempotentResave
{
  const d0 = base([tracker('Calories Burned', 'kcal', [['2026-08-20', 2600, 'x1']])]);
  const d1 = applyDraft(d0, { date: '2026-08-20', meals: [], activities: [{ name: 'Yoga', minutes: 30, kcal: 150, stepBased: false }], values: [] }, id);
  assert.equal(d1.fitnessDays?.['2026-08-20']?.burnBase, 2600);
  assert.ok(!d1.logTrackers.find(t => t.name === 'Calories Burned')!.logs.some(l => l.id === 'x1'));
  assert.equal(entry(d1, 'Calories Burned', '2026-08-20')?.id, 'auto-burn-2026-08-20');
  assert.equal(entry(d1, 'Calories Burned', '2026-08-20')?.value, 2750);
  const d2 = applyDraft(d1, { date: '2026-08-20', meals: [], activities: [], values: [] }, id);
  assert.equal(entry(d2, 'Calories Burned', '2026-08-20')?.value, 2750);
  assert.equal(dayBurn(d2, '2026-08-20').total, 2750);
}

// earlierTotal → deleteMealRecomputes → valueReplacesIntake
{
  const d0 = base([tracker('Daily Calorie Intake', 'kcal', [[TODAY, 1200]]), tracker('Protein Intake', 'g', [[TODAY, 60]])]);
  const d1 = applyDraft(d0, { date: TODAY, meals: [{ name: 'Dal', kcal: 300, proteinG: 15 }], activities: [], values: [] }, id);
  const meals = d1.fitnessDays![TODAY].meals;
  assert.deepEqual(meals.map(m => [m.name, m.kcal, m.proteinG]), [['Earlier total', 1200, 60], ['Dal', 300, 15]]);
  assert.equal(entry(d1, 'Daily Calorie Intake', TODAY)?.id, `auto-intake-${TODAY}`);
  assert.equal(entry(d1, 'Daily Calorie Intake', TODAY)?.value, 1500);
  assert.equal(entry(d1, 'Protein Intake', TODAY)?.value, 75);
  assert.deepEqual(dayIntake(d1, TODAY), { kcal: 1500, proteinG: 75 });
  assert.equal(d1.logTrackers.find(t => t.name === 'Daily Calorie Intake')!.logs.filter(l => l.date === TODAY).length, 1);

  const dal = meals.find(m => m.name === 'Dal')!;
  const d2 = editDayItem(d1, TODAY, 'meal', dal.id, null, id);
  assert.equal(entry(d2, 'Daily Calorie Intake', TODAY)?.value, 1200);
  assert.equal(entry(d2, 'Protein Intake', TODAY)?.value, 60);

  const intakeId = d2.logTrackers.find(t => t.name === 'Daily Calorie Intake')!.id;
  assert.equal(describeValueChange(d2, { date: TODAY, meals: [], activities: [], values: [] }, { trackerId: intakeId, value: 2100 }), 'replaces 1,200 kcal');
  const d3 = applyDraft(d2, { date: TODAY, meals: [], activities: [], values: [{ trackerId: intakeId, value: 2100 }] }, id);
  assert.deepEqual(d3.fitnessDays![TODAY].meals.map(m => [m.name, m.kcal, m.proteinG]), [['Day total', 2100, 60]]);
  assert.equal(entry(d3, 'Daily Calorie Intake', TODAY)?.value, 2100);
  assert.equal(entry(d3, 'Protein Intake', TODAY)?.value, 60);
}

// stepsValueManual
{
  const d0 = base([tracker('Steps', 'steps', [[TODAY, 8000, `fitbit-steps-${TODAY}`]], { healthMetric: 'steps' })]);
  const v = { trackerId: 'Steps', value: 12000 };
  assert.match(describeValueChange(d0, { date: TODAY, meals: [], activities: [], values: [v] }, v) ?? '', /Fitbit/);
  const d1 = applyDraft(d0, { date: TODAY, meals: [], activities: [], values: [v] }, id);
  const e = entry(d1, 'Steps', TODAY)!;
  assert.equal(e.value, 12000);
  assert.ok(!e.id.startsWith('fitbit-'));
  assert.equal(d1.logTrackers.find(t => t.name === 'Steps')!.logs.filter(l => l.date === TODAY).length, 1);
}

// typed burn total replaces the day's burn (activities cleared)
{
  const d1 = applyDraft(fit, { date: TODAY, meals: [], activities: [{ name: 'Yoga', minutes: 30, kcal: 150, stepBased: false }], values: [] }, id);
  const burnedId = d1.logTrackers.find(t => t.name === 'Calories Burned')!.id;
  const d2 = applyDraft(d1, { date: TODAY, meals: [], activities: [], values: [{ trackerId: burnedId, value: 2600 }] }, id);
  assert.equal(dayBurn(d2, TODAY).total, 2600);
  assert.equal(d2.fitnessDays?.[TODAY]?.activities.length ?? 0, 0);
}

// zeroIsNoEntry
{
  const d = base([tracker('Weight', 'kg', [[TODAY, 80]]), tracker('Calories Burned', 'kcal', [[TODAY, 0]])], { fitnessProfile: profile });
  assert.equal(dayBurn(d, TODAY).source, 'computed');
}

// suggestTargets
{
  const burns: [string, number][] = Array.from({ length: 14 }, (_, i) => [ymdOffset(TODAY, -i), 2600]);
  const weights: [string, number][] = Array.from({ length: 60 }, (_, i) => [ymdOffset(TODAY, -i), 93.4]);
  const s = suggestTargets(base([tracker('Calories Burned', 'kcal', burns), tracker('Weight', 'kg', weights)]), TODAY);
  assert.deepEqual(s, { steps: 10000, proteinG: 150, kcal: 2100 });
  assert.deepEqual(suggestTargets(base([]), TODAY), { steps: 10000, proteinG: null, kcal: null });
}

// loggingStreak ignores Fitbit entries
{
  const d = base([tracker('Weight', 'kg', [[TODAY, 80], [ymdOffset(TODAY, -1), 80]]),
    tracker('Steps', 'steps', [[ymdOffset(TODAY, -2), 9000, `fitbit-steps-${ymdOffset(TODAY, -2)}`]])]);
  assert.equal(loggingStreak(d, TODAY), 2);
}

// Missing trackers get created; empty day removed after deleting its only item
{
  const d1 = applyDraft(base([]), { date: TODAY, meals: [{ name: 'Apple', kcal: 95, proteinG: 0 }], activities: [], values: [] }, id);
  assert.ok(d1.logTrackers.some(t => t.name === 'Daily Calorie Intake' && t.unit === 'kcal'));
  const apple = d1.fitnessDays![TODAY].meals[0];
  const d2 = editDayItem(d1, TODAY, 'meal', apple.id, null, id);
  assert.equal(d2.fitnessDays?.[TODAY], undefined);
  assert.equal(entry(d2, 'Daily Calorie Intake', TODAY), undefined);
}

// setTargets: goals land on existing trackers, missing ones are created, profile saved
{
  const d0 = base([tracker('Weight', 'kg', [[TODAY, 93]])]);
  const d1 = setTargets(d0, profile, { weight: 85, steps: 10000, protein: 150, intake: 2100 }, id);
  assert.equal(d1.fitnessProfile, profile);
  assert.equal(d1.logTrackers.find(t => t.name === 'Weight')!.goal, 85);
  assert.equal(d1.logTrackers.find(t => t.name === 'Steps')!.goal, 10000);
  assert.equal(d1.logTrackers.find(t => t.name === 'Daily Calorie Intake')!.unit, 'kcal');
  assert.equal(d0.logTrackers[0].goal, undefined); // input not mutated
  const d2 = setTargets(d1, profile, { weight: undefined }, id);
  assert.equal(d2.logTrackers.find(t => t.name === 'Weight')!.goal, undefined);
  assert.equal(d2.logTrackers.length, d1.logTrackers.length);
}

// notesSurvive: old notes / activityNotes are kept when a day is rewritten
{
  const d0 = base([
    { id: 'ci', name: 'Daily Calorie Intake', unit: 'kcal', logs: [{ id: 'i1', date: '2026-08-20', value: 2000, notes: 'poha, thali' }] },
    { id: 'cb', name: 'Calories Burned', unit: 'kcal', logs: [{ id: 'b1', date: '2026-08-20', value: 2600, notes: 'AI total', activityNotes: '45 min walk' }] },
    { id: 'cw', name: 'Weight', unit: 'kg', logs: [{ id: 'w1', date: '2026-08-20', value: 93, notes: 'after travel' }] },
  ]);
  const d1 = applyDraft(d0, { date: '2026-08-20', meals: [{ name: 'Chai', kcal: 50, proteinG: 2 }], activities: [{ name: 'Yoga', minutes: 30, kcal: 150, stepBased: false }], values: [{ trackerId: 'cw', value: 92.5 }] }, id);
  assert.equal(entry(d1, 'Daily Calorie Intake', '2026-08-20')?.notes, 'poha, thali');
  const burn = entry(d1, 'Calories Burned', '2026-08-20')!;
  assert.equal(burn.id, 'auto-burn-2026-08-20');
  assert.equal(burn.notes, 'AI total');
  assert.equal(burn.activityNotes, '45 min walk');
  assert.equal(entry(d1, 'Weight', '2026-08-20')?.notes, 'after travel');
  assert.equal(entry(d1, 'Weight', '2026-08-20')?.value, 92.5);
}

// sanitizeDraft: bad or out-of-range dates fall back; negatives clamp to 0
{
  const dr = (date: string) => sanitizeDraft({ date, meals: [{ name: 'x', kcal: -50, proteinG: -1 }], activities: [{ name: 'y', minutes: -5, kcal: -10, stepBased: false }], values: [{ trackerId: 't', value: 0 }] }, TODAY, '2026-11-20');
  for (const bad of ['2099-01-01', '2026-00-15', '2026-13-01', '2024-01-01', 'yesterday']) assert.equal(dr(bad).date, '2026-11-20', bad);
  assert.equal(dr('2026-11-25').date, '2026-11-25');
  const s = dr(TODAY);
  assert.deepEqual([s.meals[0].kcal, s.meals[0].proteinG, s.activities[0].minutes, s.activities[0].kcal], [0, 0, 0, 0]);
  assert.equal(s.values.length, 0); // a 0 value would wipe that day's entry
}

// flatAfterGap: returning after months at a new flat weight → trend re-seeds, rate ≈ 0
{
  const before = Array.from({ length: 60 }, (_, i) => ({ id: 'b' + i, date: ymdOffset('2026-08-31', i - 59), value: 96 }));
  const after = Array.from({ length: 21 }, (_, i) => ({ id: 'a' + i, date: ymdOffset('2026-12-01', i), value: 92 }));
  const s = trendSeries([...before, ...after]);
  const end = ymdOffset('2026-12-01', 20);
  close(s[s.length - 1].trend, 92, 0.05);
  close(weeklyRate(s, end), 0, 0.05);
  const s7 = trendSeries([...before, ...after.slice(0, 7)]);
  close(weeklyRate(s7, ymdOffset('2026-12-01', 6)), 0, 0.05);
}

// typed burn on a computed day warns; clearBurnBase undoes a typed total
{
  const burnedFit = applyDraft(fit, { date: TODAY, meals: [], activities: [{ name: 'Yoga', minutes: 10, kcal: 40, stepBased: false }], values: [] }, id);
  const bid = burnedFit.logTrackers.find(t => t.name === 'Calories Burned')!.id;
  const plain = editDayItem(burnedFit, TODAY, 'activity', burnedFit.fitnessDays![TODAY].activities[0].id, null, id);
  assert.match(describeValueChange(plain, { date: TODAY, meals: [], activities: [], values: [] }, { trackerId: bid, value: 300 }) ?? '', /replaces your estimated 2,149 kcal/);
  const typed = applyDraft(plain, { date: TODAY, meals: [], activities: [], values: [{ trackerId: bid, value: 300 }] }, id);
  assert.equal(dayBurn(typed, TODAY).total, 300);
  const undone = clearBurnBase(typed, TODAY, id);
  close(dayBurn(undone, TODAY).total, bmr80 + 400);
  assert.equal(undone.fitnessDays?.[TODAY], undefined);
}

// Fitbit's measured burn is the day's burn; logged workouts are already in it.
{
  const fit = tracker('Calories Burned', 'kcal', [[TODAY, 3100, `fitbit-burned-${TODAY}`]], { healthMetric: 'burned' });
  const d0 = base([tracker('Weight', 'kg', [[TODAY, 95]]), tracker('Steps', 'steps', [[TODAY, 8000]]), fit], { fitnessProfile: profile });
  const b0 = dayBurn(d0, TODAY);
  assert.equal(b0.total, 3100);
  assert.equal(b0.source, 'fitbit');
  const d1 = applyDraft(d0, { date: TODAY, meals: [], activities: [{ name: 'Gym', minutes: 45, kcal: 300, stepBased: false }], values: [] }, id);
  const b1 = dayBurn(d1, TODAY);
  assert.equal(b1.total, 3100, 'a workout is not added on top of the Fitbit burn');
  assert.equal(b1.activities[0].counted, false);
  assert.equal(entry(d1, 'Calories Burned', TODAY)!.id, `fitbit-burned-${TODAY}`, 'the Fitbit entry is kept');
  assert.equal(d1.fitnessDays![TODAY].burnBase, undefined, 'the Fitbit value is not turned into a typed base');
  const d2 = applyDraft(d0, { date: TODAY, meals: [], activities: [], values: [{ trackerId: 'Calories Burned', value: 2500 }] }, id);
  assert.equal(dayBurn(d2, TODAY).total, 2500, 'a typed burn total still wins');
}
// Steps streak: consecutive days at or over the step goal, Fitbit days included; today counts once reached.
{
  const days = (vals: number[]) => vals.map((v, i) => [ymdOffset(TODAY, -i), v, `fitbit-steps-${ymdOffset(TODAY, -i)}`] as [string, number, string]);
  const st = (vals: number[], goal?: number) => base([tracker('Steps', 'steps', days(vals), { healthMetric: 'steps', ...(goal ? { goal } : {}) })]);
  assert.equal(stepsStreak(st([4000, 10500, 12000, 10032, 11000, 10100, 900]), TODAY), 5, "today isn't done yet: count from yesterday");
  assert.equal(stepsStreak(st([10200, 10500, 12000]), TODAY), 3, 'today counts once the goal is reached');
  assert.equal(stepsStreak(st([9000, 8000, 9500], 8000), TODAY), 3, "uses the tracker's own goal");
  assert.equal(stepsStreak(base([]), TODAY), 0);
}
console.log('fitness checks passed');
