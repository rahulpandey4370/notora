// A task's status on a day, in one place: which day lists it is on, whether it is done there, what a tick does (and
// its XP), when a past day is overdue, and the week and month XP totals. The Tasks page, the Dashboard, the calendar
// and the chat each had their own copy of these rules, and the copies disagreed. Which days a repeating task covers
// stays in lib/tasks. Pure; checked by `npx tsx src/lib/task-status.check.ts`.
import { addDays, endOfWeek, format, getDaysInMonth, isSameDay, isSameMonth, isWithinInterval, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import type { Task } from '@/lib/types';
import { monthlyShowsIn, recurringShowsOn } from '@/lib/tasks';
import { weekStart } from '@/lib/week';
import { getTaskXp } from '@/lib/utils';

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * A stored date as a local day: 'yyyy-MM-dd' today, a full ISO timestamp in older data. A value that can't be read
 * gives '' (so it matches no day) instead of throwing while a screen draws. Remembered per string: the calendar asks
 * for every task on every day it shows.
 */
const days = new Map<string, string>();
export function taskDay(v?: string): string {
  if (!v) return '';
  let day = days.get(v);
  if (day === undefined) {
    const d = parseISO(v);
    day = Number.isNaN(d.getTime()) ? '' : ymd(d);
    days.set(v, day);
  }
  return day;
}

/** The Monday and Sunday of a weekly task's week, or null when its week can't be read. */
function weekSpan(task: Task): [string, string] | null {
  const monday = task.week ? weekStart(task.week) : null;
  return monday ? [ymd(monday), ymd(addDays(monday, 6))] : null;
}
const inSpan = (day: string, span: [string, string]) => day !== '' && day >= span[0] && day <= span[1];

/** Is the task on the day list for `day`? Monthly tasks never are: they have their own list. */
export function showsOn(task: Task, day: string): boolean {
  switch (task.type) {
    case 'single': return !!task.date && taskDay(task.date) === day;
    case 'recurring': return recurringShowsOn(task, day);
    case 'weekly': { const span = weekSpan(task); return !!span && inSpan(day, span); }
    default: return false;
  }
}
export const tasksOn = (tasks: Task[], day: string) => tasks.filter(t => showsOn(t, day));

/** Where a tick made on `day` is stored: that day; for a monthly task, the 1st of its month. */
export const tickKey = (task: Task, day: string) => (task.type === 'monthly' ? `${day.slice(0, 7)}-01` : day);

/** A weekly task's ticks that fall in its own week. Ticks are stored on the day they were made. */
function weekTicks(task: Task): string[] {
  const span = weekSpan(task);
  return span ? (task.completions ?? []).filter(c => inSpan(taskDay(c), span)) : [];
}

/**
 * Is the task done, as seen on `day`? A one-off is done on its own day, a daily task per day, a monthly task per
 * month, and a weekly task for its whole week once it is ticked on any day of it.
 */
export function doneOn(task: Task, day: string): boolean {
  const done = task.completions ?? [];
  if (task.type === 'weekly') return weekTicks(task).length > 0;
  if (task.type === 'single') return !!task.date && done.includes(taskDay(task.date));
  return done.includes(tickKey(task, day));
}

/**
 * Tick or untick the task on `day`: the task afterwards, and the XP that goes with it. Unticking a weekly task
 * removes every tick in its week (older data can hold several, each of which was paid XP) and takes each one's XP back.
 */
export function toggleOn(task: Task, day: string): { task: Task; xpDelta: number; done: boolean } {
  const xp = getTaskXp(task);
  const done = task.completions ?? [];
  if (task.type === 'weekly' && weekSpan(task)) {
    const mine = weekTicks(task);
    if (mine.length) return { task: { ...task, completions: done.filter(c => !mine.includes(c)) }, xpDelta: -xp * mine.length, done: false };
    return { task: { ...task, completions: [...done, day] }, xpDelta: xp, done: true };
  }
  const key = tickKey(task, day);
  return done.includes(key)
    ? { task: { ...task, completions: done.filter(c => c !== key) }, xpDelta: -xp, done: false }
    : { task: unskip({ ...task, completions: [...done, key] }, ownKey(task, day)), xpDelta: xp, done: true }; // doing it after all clears a "won't do"
}

// --- Won't do -------------------------------------------------------------------------------------------------------

/** The key a task's own status is stored under on `day`: a one-off always uses its own day. */
const ownKey = (task: Task, day: string) => (task.type === 'single' && task.date ? taskDay(task.date) : tickKey(task, day));
function unskip(task: Task, key: string): Task {
  if (!task.skipped?.includes(key)) return task;
  const { skipped, ...rest } = task;
  const left = skipped.filter(k => k !== key);
  return left.length ? { ...rest, skipped: left } : rest;
}

/** Marked "won't do" on `day`: it stays on its day but is no longer open or overdue. */
export const skippedOn = (task: Task, day: string) => !!task.skipped?.includes(ownKey(task, day));

/** Mark "won't do" on `day`, or undo it. No XP either way. A done task is left alone: done wins. */
export function skipOn(task: Task, day: string): Task {
  if (doneOn(task, day)) return task;
  const key = ownKey(task, day);
  return skippedOn(task, day) ? unskip(task, key) : { ...task, skipped: [...(task.skipped ?? []), key] };
}

/**
 * A task's status on a day, as one named value:
 *   done       ticked
 *   wontDo     marked "won't do"
 *   open       today or later
 *   yesterday  yesterday's, unticked, and still inside the grace (before OVERDUE_GRACE_HOUR today)
 *   overdue    its day has passed
 * Done wins over won't do; both win over the clock.
 */
export type DayStatus = 'done' | 'wontDo' | 'open' | 'yesterday' | 'overdue';
export function statusOn(task: Task, day: string, now: Date, graceHour: number | undefined = OVERDUE_GRACE_HOUR): DayStatus {
  if (doneOn(task, day)) return 'done';
  if (skippedOn(task, day)) return 'wontDo';
  if (day >= ymd(now)) return 'open';
  return overdueOn(day, now, graceHour) ? 'overdue' : 'yesterday';
}

/**
 * Past one-off tasks still waiting, for the Dashboard: yesterday's inside the grace, and the overdue ones.
 * `now` must be the real time, not midnight, or yesterday's would never turn overdue.
 */
export function pastOpen(tasks: Task[], now: Date, graceHour: number | undefined = OVERDUE_GRACE_HOUR): { yesterday: Task[]; overdue: Task[] } {
  const yesterday: Task[] = [], overdue: Task[] = [];
  for (const t of tasks) {
    const day = t.type === 'single' ? taskDay(t.date) : '';
    if (!day) continue; // not a one-off, or its date can't be read
    const status = statusOn(t, day, now, graceHour);
    if (status === 'yesterday') yesterday.push(t); else if (status === 'overdue') overdue.push(t);
  }
  return { yesterday, overdue };
}

/** Carry a one-off task to the next day: one more carry (each costs XP, see getTaskXp), and any "won't do" is cleared. */
export function carriedForward(task: Task): Task {
  const { skipped: _dropped, ...rest } = task;
  return { ...rest, date: ymd(addDays(parseISO(task.date!), 1)), carryForwardCount: (task.carryForwardCount || 0) + 1, originalXp: task.originalXp || getTaskXp(task) };
}

/**
 * The hour (today) until which yesterday's unticked tasks are not yet overdue. Until then they are simply
 * "from yesterday": no overdue styling, no Carry forward. Used by the Tasks page, the Dashboard and the suggestions.
 */
export const OVERDUE_GRACE_HOUR = 23;

/** Has `day` passed? With `graceHour`, yesterday only counts as passed from that hour today. */
export function overdueOn(day: string, now: Date, graceHour?: number): boolean {
  if (day >= ymd(now)) return false;
  if (graceHour != null && day === ymd(addDays(now, -1)) && now.getHours() < graceHour) return false;
  return true;
}

/** XP earned and possible in the Mon–Sun week holding `today` (the Dashboard's week ring). */
export function weekXp(tasks: Task[], today: Date): { earned: number; possible: number } {
  const monday = startOfWeek(today, { weekStartsOn: 1 }), sunday = endOfWeek(today, { weekStartsOn: 1 });
  let earned = 0, possible = 0;
  for (const task of tasks) {
    const xp = getTaskXp(task), done = task.completions || [];
    if (task.type === 'weekly' && task.week) {
      const first = weekStart(task.week);
      if (first && isSameDay(first, monday)) {
        possible += xp;
        if (done.some(c => isWithinInterval(parseISO(c), { start: monday, end: sunday }))) earned += xp;
      }
    } else if (task.type === 'recurring') {
      for (let i = 0; i < 7; i++) {
        const day = ymd(addDays(monday, i));
        if (recurringShowsOn(task, day)) { possible += xp; if (done.includes(day)) earned += xp; }
      }
    } else if (task.type === 'single' && task.date) {
      const day = startOfDay(parseISO(task.date));
      if (isWithinInterval(day, { start: monday, end: sunday })) { possible += xp; if (done.includes(ymd(day))) earned += xp; }
    }
  }
  return { earned, possible };
}

/** XP earned and possible in the month holding `month` (the month ring on the Dashboard and the Tasks page). */
export function monthXp(tasks: Task[], month: Date): { earned: number; possible: number } {
  const first = startOfMonth(month);
  let earned = 0, possible = 0;
  for (const task of tasks) {
    const xp = getTaskXp(task), done = task.completions || [];
    const tickedThisMonth = done.some(c => isSameMonth(new Date(c), month));
    if (task.type === 'monthly' && monthlyShowsIn(task, format(month, 'yyyy-MM'))) {
      possible += xp; if (tickedThisMonth) earned += xp;
    } else if (task.type === 'weekly' && task.week) {
      const start = weekStart(task.week);
      if (start && isSameMonth(start, month)) { possible += xp; if (tickedThisMonth) earned += xp; }
    } else if (task.type === 'single' && task.date) {
      if (isSameMonth(parseISO(task.date), month)) { possible += xp; if (tickedThisMonth) earned += xp; }
    } else if (task.type === 'recurring') {
      for (let i = 0; i < getDaysInMonth(month); i++) {
        const day = ymd(addDays(first, i));
        if (recurringShowsOn(task, day)) { possible += xp; if (done.includes(day)) earned += xp; }
      }
    }
  }
  return { earned, possible };
}
