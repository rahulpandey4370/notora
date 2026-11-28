// What the Day End summary and the Weekly Review are built from, worked out from the workspace. The dialogs ask the AI
// again only when this changes (a save that touches nothing they read asks nothing), and wait while it isn't there yet.
// Pure; checked by `npx tsx src/lib/review-input.check.ts`.
import { eachDayOfInterval, endOfWeek, format, isWithinInterval, parseISO, startOfWeek, subWeeks } from 'date-fns';
import type { AppData, Task } from '@/lib/types';
import type { WeeklyReviewInput } from '@/ai/flows/weekly-review';

/** Titles of the tasks ticked today. null while the workspace hasn't loaded: "nothing done" can't be told from "not here yet". */
export function dayEndInput(tasks: Task[] | undefined, today: string): string[] | null {
  return tasks ? tasks.filter(t => (t.completions || []).includes(today)).map(t => t.title) : null;
}

const XP_BY_PRIORITY: Record<string, number> = { Easy: 5, Medium: 10, Hard: 15 };

/** The Mon–Sun week holding `now`, and the one before it. */
export function weekBounds(now: Date) {
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
    prevStart: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
    prevEnd: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
  };
}

/** This week's tasks, trackers and journal for the review. null when nothing was logged this week. */
export function weeklyInput(data: AppData, now: Date): WeeklyReviewInput | null {
  const { start, end, prevStart, prevEnd } = weekBounds(now);
  const weekDays = eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
  const inWeek = (ymd: string) => weekDays.includes(ymd);

  // --- Tasks completed this week ---
  const taskStats = (data.tasks || [])
    .map(t => ({
      title: t.title,
      priority: t.priority,
      type: t.type,
      completedThisWeek: (t.completions || []).filter(inWeek).length,
    }))
    .filter(t => t.completedThisWeek > 0);

  const totalCompletions = taskStats.reduce((s, t) => s + t.completedThisWeek, 0);
  const xpEarned = taskStats.reduce((s, t) => s + t.completedThisWeek * (XP_BY_PRIORITY[t.priority] ?? 10), 0);

  // --- Tracker series, this week vs last ---
  const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
  const trackers = (data.logTrackers || []).map(tr => {
    const thisWeek = tr.logs.filter(l => inWeek(l.date));
    const lastWeek = tr.logs.filter(l => {
      try {
        return isWithinInterval(parseISO(l.date), { start: prevStart, end: prevEnd });
      } catch {
        return false;
      }
    });
    return {
      name: tr.name,
      unit: tr.unit,
      thisWeekAvg: avg(thisWeek.map(l => l.value)),
      lastWeekAvg: avg(lastWeek.map(l => l.value)),
      values: thisWeek
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(l => ({ date: l.date, value: l.value })),
    };
  });

  // --- Journal entries from this week (trimmed, not full text) ---
  const journal = (data.journalEntries || [])
    .filter(e => inWeek((e.date || '').slice(0, 10)))
    .map(e => ({
      date: (e.date || '').slice(0, 10),
      mood: e.mood ?? null,
      tags: e.tags ?? null,
      excerpt: (e.content || '').replace(/\s+/g, ' ').slice(0, 400),
    }));

  if (totalCompletions === 0 && trackers.every(t => t.values.length === 0) && journal.length === 0) return null;

  return {
    weekLabel: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
    tasks: taskStats,
    totalCompletions,
    totalPossible: Math.max(totalCompletions, (data.tasks || []).length),
    xpEarned,
    trackers,
    journal,
  };
}
