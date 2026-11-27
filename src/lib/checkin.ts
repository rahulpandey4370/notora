// The weekly check-in: the 7 days ending yesterday, scored out of 10 on five
// habits (2 points each), with the one thing to focus on next. No AI.
// Pure; checked by `npx tsx src/lib/checkin.check.ts`.
import type { AppData } from '@/lib/types';
import { addDays, dayMacros, findTracker, fmtSleep, trendSeries, valueOn } from '@/lib/fitness';

export type Area = { id: 'food' | 'calories' | 'protein' | 'steps' | 'sleep'; label: string; points: 0 | 1 | 2; detail: string };
export type Checkin = {
  from: string; to: string; score: number; areas: Area[];
  focus?: { area: Area['id']; text: string };
  avg: { kcal: number | null; protein: number | null; steps: number | null; sleepH: number | null };
  trendChange: number | null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pts = (hit: number, of: number, two: number, one: number): 0 | 1 | 2 => (of === 0 ? 0 : hit >= two ? 2 : hit >= one ? 1 : 0);
const k = (n: number) => Math.round(n).toLocaleString('en-IN');

const TIPS: Record<Area['id'], string> = {
  food: 'Log every meal this week, even the small ones. Use the meal reminders and “Same as yesterday”.',
  calories: 'Plan dinner around what’s left after lunch; the 8:30 pm nudge tells you the number.',
  protein: 'Add one 25–30 g protein item a day: a scoop of whey, 200 g curd, 100 g paneer or 3 eggs.',
  steps: 'Add a 15-minute walk after lunch and after dinner; that’s about 3,000 extra steps.',
  sleep: 'Aim for lights-out 30 minutes earlier; short nights push hunger up the next day.',
};

export function weeklyCheckin(data: AppData, today: string): Checkin | null {
  const to = addDays(today, -1), from = addDays(to, -6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const kcalGoal = findTracker(data, 'intake')?.goal, proteinGoal = findTracker(data, 'protein')?.goal;
  const stepsT = findTracker(data, 'steps'), sleepT = findTracker(data, 'sleep');
  const stepGoal = stepsT?.goal || 10000, sleepGoal = sleepT?.goal || 7;
  const full = (kcal: number) => kcal >= (kcalGoal ? kcalGoal * 0.4 : 900);

  const food = days.map(d => dayMacros(data, d)).filter(m => full(m.kcal));
  const steps = days.map(d => valueOn(stepsT, d)).filter((v): v is number => v != null);
  const sleep = days.map(d => valueOn(sleepT, d)).filter((v): v is number => v != null);
  if (!food.length && !steps.length && !sleep.length) return null;

  const areas: Area[] = [{ id: 'food', label: 'Logging', points: pts(food.length, 7, 7, 5), detail: `${food.length} of 7 days fully logged` }];
  if (kcalGoal && food.length) {
    const on = food.filter(m => m.kcal <= kcalGoal * 1.05).length;
    areas.push({ id: 'calories', label: 'Calories', points: pts(on, food.length, food.length - 1, Math.ceil(food.length / 2)), detail: `${on} of ${food.length} logged days at or under ${k(kcalGoal)} kcal` });
  }
  if (proteinGoal && food.length) {
    const on = food.filter(m => m.proteinG >= proteinGoal * 0.9).length;
    areas.push({ id: 'protein', label: 'Protein', points: pts(on, food.length, food.length - 1, Math.ceil(food.length / 2)), detail: `${on} of ${food.length} days near ${k(proteinGoal)} g` });
  }
  if (steps.length) {
    const on = steps.filter(v => v >= stepGoal).length;
    areas.push({ id: 'steps', label: 'Steps', points: pts(on, steps.length, 5, 3), detail: `${on} of 7 days at ${k(stepGoal)}+ (avg ${k(mean(steps)!)})` });
  }
  if (sleep.length) {
    const avg = mean(sleep)!;
    areas.push({ id: 'sleep', label: 'Sleep', points: avg >= sleepGoal ? 2 : avg >= sleepGoal - 0.75 ? 1 : 0, detail: `avg ${fmtSleep(avg)} a night` });
  }
  const score = Math.round((areas.reduce((s, a) => s + a.points, 0) / (areas.length * 2)) * 10);
  // Weakest habit; ties go to the one that matters most for fat loss.
  const order: Area['id'][] = ['food', 'calories', 'protein', 'steps', 'sleep'];
  const weakest = [...areas].sort((a, b) => a.points - b.points || order.indexOf(a.id) - order.indexOf(b.id))[0];

  const series = trendSeries(findTracker(data, 'weight')?.logs ?? []);
  const at = (d: string) => [...series].reverse().find(p => p.date <= d)?.trend;
  const a = at(to), b = at(addDays(from, -1));
  return {
    from, to, score, areas,
    ...(weakest.points < 2 ? { focus: { area: weakest.id, text: TIPS[weakest.id] } } : {}),
    avg: { kcal: mean(food.map(m => m.kcal)), protein: mean(food.map(m => m.proteinG)), steps: mean(steps), sleepH: mean(sleep) },
    trendChange: a != null && b != null ? Math.round((a - b) * 10) / 10 : null,
  };
}

/** The Sunday push. */
export function checkinPush(c: Checkin): { title: string; body: string; url: string } {
  const bits = [c.trendChange != null ? `trend ${c.trendChange > 0 ? '+' : c.trendChange < 0 ? '−' : '±'}${Math.abs(c.trendChange)} kg` : null,
    ...c.areas.filter(a => a.id !== 'food').map(a => `${a.label.toLowerCase()} ${a.points}/2`)].filter(Boolean);
  const focus = c.areas.find(a => a.id === c.focus?.area);
  return { title: `📋 Your week: ${c.score}/10`, body: `${bits.join(' · ')}${focus ? `. Focus this week: ${focus.label.toLowerCase()}.` : '. Every habit on track!'}`, url: '/logs' };
}
