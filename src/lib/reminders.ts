// Meal-time reminders for the Logs page. The cron hits /api/notify/tick every
// 30 minutes; this decides what is due and what to say (or nothing, when it's
// already logged). Pure; checked by `npx tsx src/lib/reminders.check.ts`.
import type { AppData, MealSlot } from '@/lib/types';
import { dayMacros, findTracker, quickPicks, valueOn } from '@/lib/fitness';
import { scaleFood, type Food } from '@/lib/food-match';

export type ReminderId = MealSlot | 'close' | 'checkin' | 'tasks' | 'wrapup';
/** Reminders about food: only for people who use the Logs page. 'tasks' and 'wrapup' go to everyone with notifications on. */
export const isMealReminder = (id: ReminderId) => id !== 'tasks' && id !== 'wrapup';
/** Local times (APP_TIMEZONE). `days`: 0 = Sunday. Close-the-day sits before dinner so there's still time to act on it. */
export const SCHEDULE: { id: ReminderId; at: string; days?: number[] }[] = [
  { id: 'tasks', at: '09:00' },
  { id: 'breakfast', at: '10:00' },
  { id: 'checkin', at: '11:00', days: [0] },
  { id: 'morningSnack', at: '11:30' },
  { id: 'lunch', at: '13:00' },
  { id: 'eveningSnack', at: '19:00' },
  { id: 'close', at: '20:30' },
  { id: 'dinner', at: '22:00' },
  { id: 'wrapup', at: '23:00' },
];
const WINDOW_MIN = 25; // a late cron run still counts; the next one (30 min on) doesn't

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** Reminders due at this local time: from their time to 25 minutes after. */
export const dueReminders = (hhmm: string, weekday: number): ReminderId[] =>
  SCHEDULE.filter(r => (!r.days || r.days.includes(weekday)) && mins(hhmm) - mins(r.at) >= 0 && mins(hhmm) - mins(r.at) < WINDOW_MIN).map(r => r.id);

export type Payload = { title: string; body: string; url: string };
const k = (n: number) => Math.round(n).toLocaleString('en-IN');
const LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', morningSnack: 'Morning snack', lunch: 'Lunch', eveningSnack: 'Evening snack', dinner: 'Dinner' };
const EMOJI: Record<MealSlot, string> = { breakfast: '🍳', morningSnack: '🍎', lunch: '🍛', eveningSnack: '☕', dinner: '🍽️' };

/**
 * Things that would fit what's left today, best protein per calorie first:
 * your saved foods at their usual serving, and meals you've logged before.
 */
export function fitsLeft(data: AppData, today: string, foods: Food[], kcalLeft: number, n = 2): string[] {
  const options: { name: string; kcal: number; protein: number }[] = [];
  for (const f of foods) {
    const m = scaleFood(f, f.unit === 'serving' || f.servings.length ? { count: 1 } : { grams: 100 });
    if (m) options.push({ name: f.unit === 'serving' || !f.servings.length ? f.name : `${f.name} (1 ${f.servings[0].label})`, kcal: m.kcal, protein: m.proteinG });
  }
  for (const slot of ['dinner', 'eveningSnack', 'lunch'] as MealSlot[]) {
    const q = quickPicks(data, today, slot);
    for (const m of [...q.usual, ...q.yesterday]) options.push({ name: m.name, kcal: m.kcal, protein: m.proteinG });
  }
  const seen = new Set<string>();
  return options
    .filter(o => o.kcal > 0 && o.kcal <= kcalLeft && o.protein > 0)
    .sort((a, b) => b.protein / b.kcal - a.protein / a.kcal)
    .filter(o => { const key = o.name.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, n).map(o => o.name);
}

/** What to send for one reminder, or null when there's nothing to say (already logged, no targets…). */
export function reminderFor(id: ReminderId, data: AppData, today: string, opts: { weighedToday: boolean; foods?: Food[]; checkin?: Payload | null; todayTasks?: { title: string; done: boolean }[]; usesLogs?: boolean }): Payload | null {
  const meals = data.fitnessDays?.[today]?.meals ?? [];
  const has = (slot: MealSlot) => meals.some(m => m.slot === slot);
  const kcalGoal = findTracker(data, 'intake')?.goal, proteinGoal = findTracker(data, 'protein')?.goal;
  const eaten = dayMacros(data, today);
  const url = '/logs';

  if (id === 'checkin') return opts.checkin ?? null;
  if (id === 'tasks') {
    const tasks = opts.todayTasks ?? [];
    const open = tasks.filter(t => !t.done);
    if (!tasks.length) return { title: '📝 Plan your day', body: 'No tasks for today yet. Add the 3 that matter most.', url: '/tasks' };
    const top = open.slice(0, 3).map(t => t.title).join(', ') + (open.length > 3 ? ` +${open.length - 3} more` : '');
    return { title: `📝 ${open.length} task${open.length === 1 ? '' : 's'} planned today`, body: open.length ? `${top}. Anything to add?` : 'All done already. Add anything new for today?', url: '/tasks' };
  }
  if (id === 'wrapup') {
    // 11 PM: tick off what's done and log what's missing, before the day closes. Nothing to say → no push.
    const open = (opts.todayTasks ?? []).filter(t => !t.done);
    const missing = opts.usesLogs ? (['breakfast', 'lunch', 'dinner'] as MealSlot[]).filter(s => !has(s)).map(s => LABEL[s].toLowerCase()) : [];
    if (!open.length && !missing.length) return null;
    const bits = [
      open.length ? `${open.length} task${open.length === 1 ? '' : 's'} still open (${open.slice(0, 2).map(t => t.title).join(', ')}${open.length > 2 ? '…' : ''}): tick off what’s done.` : null,
      missing.length ? `No ${missing.join(' or ')} logged yet.` : null,
    ].filter(Boolean);
    return { title: '🌙 Wrap up today', body: bits.join(' '), url: open.length ? '/tasks' : url };
  }
  if (id === 'breakfast') {
    if (has('breakfast') && opts.weighedToday) return null;
    if (has('breakfast')) return { title: '⚖️ Weigh in for today', body: 'Step on the scale before you eat more; your trend needs daily weigh-ins.', url };
    return { title: '🍳 Breakfast + weigh-in', body: opts.weighedToday ? 'Log what you had for breakfast.' : 'Log breakfast and today’s weight (before food if you can).', url };
  }
  if (id === 'close') {
    if (!meals.length || (kcalGoal == null && proteinGoal == null)) return null;
    const kcalLeft = kcalGoal != null ? kcalGoal - eaten.kcal : null;
    const proteinLeft = proteinGoal != null ? Math.max(0, proteinGoal - eaten.proteinG) : null;
    if (kcalLeft != null && kcalLeft < 0) return { title: `🌙 ${k(-kcalLeft)} kcal over today`, body: proteinLeft ? `Still ${k(proteinLeft)} g protein short: keep dinner light and protein-first.` : 'Keep dinner light, and a 20-minute walk helps.', url };
    const ideas = kcalLeft != null ? fitsLeft(data, today, opts.foods ?? [], kcalLeft) : [];
    const left = [proteinLeft ? `${k(proteinLeft)} g protein` : null, kcalLeft != null ? `${k(kcalLeft)} kcal` : null].filter(Boolean).join(' and ');
    if (!proteinLeft) return { title: '🌙 Protein done ✓', body: kcalLeft != null ? `${k(kcalLeft)} kcal left for the rest of today.` : 'Nice work today.', url };
    return { title: `🌙 ${left} left`, body: ideas.length ? `${ideas.join(' or ')} would fit.` : 'Plan a protein-first dinner to close the gap.', url };
  }
  // A meal section
  if (has(id)) return null;
  const left = kcalGoal != null ? kcalGoal - eaten.kcal : null;
  const usual = quickPicks(data, today, id);
  const hint = usual.yesterday.length ? 'Same as yesterday is one tap.' : usual.usual.length ? `Usual: ${usual.usual[0].name}.` : '';
  return {
    title: `${EMOJI[id]} ${LABEL[id]}: log it while you remember`,
    body: [left != null ? (left >= 0 ? `${k(left)} kcal left today.` : `${k(-left)} kcal over today.`) : null, hint].filter(Boolean).join(' ') || 'Tap to log it.',
    url,
  };
}

/** Weighed today in the app or synced from Fitbit. */
export const weighedOn = (data: AppData, ymd: string) => valueOn(findTracker(data, 'weight'), ymd) != null;
