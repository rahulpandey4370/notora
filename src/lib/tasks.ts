// Which days recurring and monthly tasks show on; checked by `npx tsx src/lib/tasks.check.ts`.
//
// `ongoing: true` tasks repeat from their start until `endsOn` (the last day, yyyy-MM-dd;
// for monthly tasks its month is the last month). Earlier days keep the task and its
// completions. `ongoing: false` (or unset, before the upgrade) is the old rule:
// recurring tasks show only in the month they were created, monthly tasks only in their month.
import { format } from 'date-fns';
import type { Task } from '@/lib/types';

/** Local yyyy-MM-dd of a task's creation time. */
export const localYmd = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');

export function recurringShowsOn(task: Task, day: string, start = localYmd(task.createdAt)): boolean {
  const from = task.startsOn ?? start; // an edited copy starts on the day of the edit
  if (task.type !== 'recurring' || day < from) return false;
  if (task.endsOn && day > task.endsOn) return false;
  return task.ongoing ? true : day.slice(0, 7) === from.slice(0, 7);
}

export function monthlyShowsIn(task: Task, ym: string): boolean {
  if (task.type !== 'monthly' || !task.month || ym < task.month) return false;
  if (task.endsOn && ym > task.endsOn.slice(0, 7)) return false;
  return task.ongoing ? true : ym === task.month;
}

/** "Stop repeating": still there today (this month for monthly), gone after. */
export const stopRepeating = (task: Task, today: string): Task => ({ ...task, ongoing: true, endsOn: today });
export const resumeRepeating = (task: Task): Task => { const { endsOn: _, ...rest } = task; return { ...rest, ongoing: true }; };
export const isRepeating = (task: Task) => !!task.ongoing && !task.endsOn;

const dayBefore = (ymd: string) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
type Change = Partial<Pick<Task, 'title' | 'priority'>>;

/** Where "from today" starts for this task: the day (recurring) or the 1st of this month (monthly), and whether it has any history before it. */
function cut(task: Task, today: string) {
  if (task.type === 'monthly') {
    const first = `${today.slice(0, 7)}-01`;
    return { from: first, hasPast: (task.month ?? '') < today.slice(0, 7) };
  }
  return { from: today, hasPast: (task.startsOn ?? localYmd(task.createdAt)) < today };
}

/**
 * Edit a repeating task from today on. Earlier days keep the old task and its ticks
 * (it now ends the day/month before); an edited copy takes over from today, with today's tick.
 * A task with no history yet is simply edited in place.
 */
export function editFrom(task: Task, change: Change, today: string, newId: () => string): Task[] {
  const { from, hasPast } = cut(task, today);
  if (!hasPast) return [{ ...task, ...change }];
  const done = task.completions ?? [];
  const old: Task = { ...task, ongoing: true, endsOn: dayBefore(from), completions: done.filter(c => c < from) };
  const next: Task = {
    ...task, ...change, id: newId(), createdAt: new Date().toISOString(), ongoing: true, carryForwardCount: 0,
    completions: done.filter(c => c >= from),
    ...(task.type === 'monthly' ? { month: today.slice(0, 7) } : { startsOn: today }),
  };
  if (!(task.endsOn && task.endsOn >= from)) delete next.endsOn;
  return [old, next];
}

/** Delete a repeating task from today on: earlier days keep it and their ticks. `removed` = ticks dropped (for XP). */
export function deleteFrom(task: Task, today: string): { task: Task | null; removed: number } {
  const { from, hasPast } = cut(task, today);
  const done = task.completions ?? [];
  if (!hasPast) return { task: null, removed: done.length };
  const kept = done.filter(c => c < from);
  return { task: { ...task, ongoing: true, endsOn: dayBefore(from), completions: kept }, removed: done.length - kept.length };
}

/**
 * One-time upgrade of old-style recurring/monthly tasks. Each task used to be re-added every
 * month, so for each title the latest copy carries on if it belongs to this month (or later)
 * and every older copy keeps just its own month. Returns null when there is nothing to upgrade.
 */
export function adoptOngoing(tasks: Task[], today: string): Task[] | null {
  const legacy = tasks.filter(t => (t.type === 'recurring' || t.type === 'monthly') && t.ongoing === undefined);
  if (!legacy.length) return null;
  const thisMonth = today.slice(0, 7);
  const monthOf = (t: Task) => (t.type === 'monthly' ? t.month ?? '' : localYmd(t.createdAt).slice(0, 7));
  const latest = new Map<string, Task>();
  for (const t of legacy) {
    const k = `${t.type}:${t.title.trim().toLowerCase()}`;
    const cur = latest.get(k);
    if (!cur || monthOf(t) > monthOf(cur) || (monthOf(t) === monthOf(cur) && t.createdAt > cur.createdAt)) latest.set(k, t);
  }
  const keep = new Set([...latest.values()].filter(t => monthOf(t) >= thisMonth).map(t => t.id));
  return tasks.map(t => (legacy.includes(t) ? { ...t, ongoing: keep.has(t.id) } : t));
}
