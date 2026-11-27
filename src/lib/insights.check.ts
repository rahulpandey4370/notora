// Run: npx tsx src/lib/insights.check.ts
import assert from 'node:assert/strict';
import type { AppData, LogEntry } from './types';
import { addDays } from './fitness';
import { foodInsights, patterns, records, whatIf } from './insights';

const TODAY = '2026-11-26';
const days = Array.from({ length: 40 }, (_, i) => addDays(TODAY, -1 - i));
const logs = (f: (d: string, i: number) => number | null): LogEntry[] => days.flatMap((d, i) => { const v = f(d, i); return v == null ? [] : [{ id: `x-${d}`, date: d, value: v }]; });
// Every 3rd morning follows a short night (5.5 h, credited to that date). Those days: +400 kcal, −3,000 steps, RHR +3.
const shortNight = (i: number) => i % 3 === 0;
const data = {
  logTrackers: [
    { id: 'z', name: 'Sleep', unit: 'hours', goal: 8, healthMetric: 'sleep', logs: logs((_d, i) => (shortNight(i) ? 5.5 : 7.5)) },
    { id: 'i', name: 'Daily Calorie Intake', unit: 'kcal', goal: 2000, logs: logs((_d, i) => (shortNight(i) ? 2300 : 1900)) },
    { id: 's', name: 'Steps', unit: 'steps', goal: 10000, healthMetric: 'steps', logs: logs((_d, i) => (shortNight(i) ? 6000 : 9000) + (i % 2 ? 0 : 2000)) },
    { id: 'r', name: 'Resting heart rate', unit: 'bpm', healthMetric: 'restingHr', logs: logs((_d, i) => (shortNight(i) ? 64 : 61)) },
    { id: 'p', name: 'Protein Intake', unit: 'g', goal: 150, logs: logs(() => 120) },
    { id: 'w', name: 'Weight', unit: 'kg', logs: logs((_d, i) => 90 + i * 0.03) },
  ],
} as unknown as AppData;

const p = patterns(data, TODAY);
const by = (id: string) => p.find(x => x.id === id);
assert.match(by('sleep-food')!.text, /eat 400 kcal more that day/, 'short night compared with the SAME date’s food');
assert.match(by('sleep-food')!.detail, /14 short nights vs 26/);
assert.equal(by('sleep-food')!.tone, 'bad');
assert.match(by('sleep-steps')!.text, /fewer steps/);
assert.match(by('sleep-rhr')!.text, /3 bpm higher/);
assert.equal(by('protein-food'), undefined, 'no protein days at all: not enough to compare');

// Alignment: steps on day D vs the sleep credited to D+1 (the night after).
const align = {
  logTrackers: [
    { id: 's', name: 'Steps', unit: 'steps', goal: 10000, healthMetric: 'steps', logs: logs((_d, i) => (i % 2 ? 12000 : 5000)) },
    // the night after a 12k day (index i, date d) is credited to d+1, which is index i−1
    { id: 'z', name: 'Sleep', unit: 'hours', healthMetric: 'sleep', logs: logs((_d, i) => (i % 2 === 0 ? 8 : 6.5)) },
  ],
} as unknown as AppData;
assert.match(patterns(align, TODAY).find(x => x.id === 'steps-sleep')!.text, /sleep 1h 30m longer that night/);

// Records and what-if.
const r = records(data, TODAY);
assert.ok(r.some(x => x.label === 'Most steps in a day' && x.value === '11,000'));
assert.ok(r.some(x => x.label === 'Lowest resting heart rate' && x.value === '61 bpm'));
const w = whatIf(92, 85, 550, TODAY)!;
assert.equal(Math.round(w.perWeek * 100) / 100, 0.5);
assert.equal(Math.round(w.weeks), 14);
assert.equal(whatIf(84, 85, 500, TODAY), null, 'already at goal');

// Foods: protein per calorie, biggest sources.
const meals = {
  logTrackers: [{ id: 'i', name: 'Daily Calorie Intake', unit: 'kcal', goal: 2000, logs: [] }],
  fitnessDays: Object.fromEntries(days.slice(0, 6).map(d => [d, { activities: [], meals: [
    { id: `a${d}`, name: 'Greek yogurt', kcal: 160, proteinG: 18, slot: 'eveningSnack' },
    { id: `b${d}`, name: 'Paneer bhurji, 2 rotis', kcal: 900, proteinG: 30, slot: 'dinner' },
  ] }])),
} as unknown as AppData;
const f = foodInsights(meals, TODAY);
assert.equal(f.protein[0].name, 'Greek yogurt');
assert.equal(f.biggest[0].name, 'Paneer bhurji, 2 rotis');
assert.equal(f.over?.label, 'Dinner', 'dinner (900) over its budget every day');
console.log('insights: all checks passed');
