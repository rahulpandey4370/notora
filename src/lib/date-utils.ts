/**
 * Date helpers for values that represent a CALENDAR DAY rather than an instant.
 *
 * Task and journal dates are "the 9th of August", not "18:30 UTC". They were
 * being stored with `date.toISOString()` on a local-midnight Date, which for
 * IST lands on `...T18:30:00Z` — the previous UTC day, sitting right on the
 * boundary. Reading it back in the same timezone happens to give the right day,
 * but anything that reads in a different zone (a UTC server render, the user
 * travelling, a DST shift) rolls it backwards by one.
 *
 * Anchoring at local NOON keeps the stored instant unambiguous: every timezone
 * on earth is within ±14h of UTC, so noon-local can never cross a day boundary
 * when re-read elsewhere.
 */

/** Serialise a picked calendar day as an instant that is safe to re-read anywhere. */
export function toCalendarISO(date: Date): string {
  const anchored = new Date(date);
  anchored.setHours(12, 0, 0, 0);
  return anchored.toISOString();
}

/** The local calendar day (YYYY-MM-DD) for a Date — never a UTC slice. */
export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
