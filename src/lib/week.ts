// Weekly tasks store `week` as "yyyy-w" (date-fns getWeek: Sunday-start weeks, week 1 holds 1 Jan, not zero-padded).
// Checked by `npx tsx src/lib/week.check.ts`.
import { addDays, getWeek, getWeekYear, setWeek, startOfWeek } from 'date-fns';

/**
 * The stored key for the Mon–Sun week holding `date`, written from its Monday (so a Sunday files with the week
 * it ends). The year is the week's year, so late-December days in week 1 file under next year.
 */
export const weekKey = (date: Date) => {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return `${getWeekYear(monday)}-${getWeek(monday)}`;
};

/** Monday of a stored week (readers compare Mon–Sun), or null for anything that isn't "yyyy-w". */
export function weekStart(week: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(week);
  if (!m) return null;
  const year = Number(m[1]), w = Number(m[2]);
  const d = setWeek(new Date(year, 0, 1), w); // 1 Jan is always in week 1 of its year
  if (w < 1 || getWeekYear(d) !== year || getWeek(d) !== w) return null;
  return addDays(startOfWeek(d), 1); // the stored week runs Sun–Sat; its Monday covers Mon–Sat of it
}
