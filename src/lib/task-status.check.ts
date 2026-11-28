// Run: npx tsx src/lib/task-status.check.ts
import assert from 'node:assert/strict';
import type { Task } from './types';
import { weekKey } from './week';
import { carriedForward, doneOn, monthXp, overdueOn, pastOpen, showsOn, skipOn, skippedOn, statusOn, taskDay, tasksOn, toggleOn, weekXp, OVERDUE_GRACE_HOUR } from './task-status';

// Saturday 28 Nov 2026; its Mon–Sun week is 23–29 Nov.
const SAT = new Date(2026, 10, 28, 15, 0, 0);
const t = (p: Partial<Task> & Pick<Task, 'id' | 'type'>): Task => ({ title: p.id, priority: 'Medium', completions: [], createdAt: '2026-11-01T08:00:00.000Z', ...p } as Task);
const single = t({ id: 's', type: 'single', date: '2026-11-28' });
const iso = t({ id: 'iso', type: 'single', date: new Date(2026, 10, 28, 9, 0, 0).toISOString() }); // older data: a full timestamp
const daily = t({ id: 'r', type: 'recurring', ongoing: true });
const weekly = t({ id: 'w', type: 'weekly', week: weekKey(SAT) });
const monthly = t({ id: 'm', type: 'monthly', month: '2026-11', ongoing: true });

// Which day lists a task is on.
assert.equal(showsOn(single, '2026-11-28'), true);
assert.equal(showsOn(single, '2026-11-27'), false);
assert.equal(showsOn(iso, '2026-11-28'), true, 'an old timestamp date still lands on its local day');
assert.equal(showsOn(daily, '2026-11-28'), true);
assert.deepEqual(['2026-11-22', '2026-11-23', '2026-11-29', '2026-11-30'].map(d => showsOn(weekly, d)), [false, true, true, false], 'a weekly task shows Monday to Sunday of its week');
assert.equal(showsOn(monthly, '2026-11-28'), false, 'monthly tasks have their own list');
assert.equal(showsOn(t({ id: 'bad', type: 'weekly', week: 'nonsense' }), '2026-11-28'), false);
assert.deepEqual(tasksOn([single, iso, daily, weekly, monthly], '2026-11-28').map(x => x.id), ['s', 'iso', 'r', 'w'], 'in stored order');

// Done on a day.
assert.equal(doneOn({ ...single, completions: ['2026-11-28'] }, '2026-11-28'), true);
assert.equal(doneOn({ ...iso, completions: ['2026-11-28'] }, '2026-11-28'), true);
assert.equal(doneOn({ ...daily, completions: ['2026-11-27'] }, '2026-11-28'), false, 'a daily task is done per day');
assert.equal(doneOn({ ...monthly, completions: ['2026-11-01'] }, '2026-11-28'), true, 'a monthly tick is stored on the 1st');
// BUG (was real): a weekly task ticked on Monday showed unticked on every other day of its week.
const tickedMonday = { ...weekly, completions: ['2026-11-23'] };
assert.deepEqual(['2026-11-23', '2026-11-24', '2026-11-28', '2026-11-29'].map(d => doneOn(tickedMonday, d)), [true, true, true, true]);
assert.equal(doneOn({ ...weekly, completions: ['2026-11-16'] }, '2026-11-28'), false, 'a tick from another week does not count');

// Ticking: the task after it, and the XP that goes with it.
let r = toggleOn(single, '2026-11-28');
assert.deepEqual([r.task.completions, r.xpDelta, r.done], [['2026-11-28'], 25, true]);
r = toggleOn(r.task, '2026-11-28');
assert.deepEqual([r.task.completions, r.xpDelta, r.done], [[], -25, false]);
assert.deepEqual(toggleOn(monthly, '2026-11-28').task.completions, ['2026-11-01']);
assert.equal(toggleOn(monthly, '2026-11-28').xpDelta, 100);
// A weekly tick is stored on the day it was made (reports read exact days) …
r = toggleOn(weekly, '2026-11-28');
assert.deepEqual([r.task.completions, r.xpDelta, r.done], [['2026-11-28'], 100, true]);
// BUG (was real): … but ticking it again on another day of the week added a second tick and the XP a second time.
r = toggleOn(tickedMonday, '2026-11-24');
assert.deepEqual([r.task.completions, r.xpDelta, r.done], [[], -100, false], 'the week is already done: this unticks it');
// Old data can hold several ticks in one week (each one was paid XP): unticking removes them all and takes each one's XP back.
const twice = { ...weekly, completions: ['2026-11-16', '2026-11-23', '2026-11-24'] };
r = toggleOn(twice, '2026-11-28');
assert.deepEqual([r.task.completions, r.xpDelta], [['2026-11-16'], -200], 'another week’s tick is left alone');

// Overdue: a day that has passed. With the grace hour, yesterday is not overdue until that hour today.
assert.equal(OVERDUE_GRACE_HOUR, 23);
assert.equal(overdueOn('2026-11-28', SAT), false, 'today');
assert.equal(overdueOn('2026-11-29', SAT), false);
assert.equal(overdueOn('2026-11-27', SAT), true, 'no grace: overdue from midnight');
assert.equal(overdueOn('2026-11-27', SAT, OVERDUE_GRACE_HOUR), false, 'with grace: not yet at 3 PM');
assert.equal(overdueOn('2026-11-27', new Date(2026, 10, 28, 23, 0, 0), OVERDUE_GRACE_HOUR), true, 'from 11 PM it is');
assert.equal(overdueOn('2026-11-26', SAT, OVERDUE_GRACE_HOUR), true, 'grace covers only yesterday');

// XP totals for the week and month: moved as they were. Weekly tasks count once however many ticks they have.
const all: Task[] = [
  { ...single, completions: ['2026-11-28'] }, iso, { ...daily, completions: ['2026-11-27'] },
  tickedMonday, { ...weekly, id: 'w2' }, twice, monthly,
];
// Week 23–29 Nov: single 25 + iso 25 + daily 7×25 + three weeklies 300 = 525 possible; earned 25 + 25 + 100 + 100.
assert.deepEqual(weekXp(all, SAT), { earned: 250, possible: 525 });
// November: single 25 + iso 25 + daily (1–30 Nov, created 1 Nov) 30×25 + weeklies 300 + monthly 100.
assert.deepEqual(monthXp(all, SAT), { earned: 250, possible: 1200 });
// A date or tick that can't be read (hand-edited or damaged data) means "not on this day", never a crash while drawing a screen.
const junk = t({ id: 'junk', type: 'single', date: 'not-a-date' });
assert.equal(taskDay('not-a-date'), '');
assert.equal(showsOn(junk, '2026-11-28'), false);
assert.equal(doneOn({ ...junk, completions: ['2026-11-28'] }, '2026-11-28'), false);
assert.equal(doneOn({ ...weekly, completions: ['garbage', '2026-11-23'] }, '2026-11-28'), true, 'a bad tick is skipped, a good one still counts');
assert.equal(toggleOn({ ...weekly, completions: ['garbage'] }, '2026-11-28').done, true);
assert.deepEqual(tasksOn([junk, single], '2026-11-28').map(x => x.id), ['s']);

// --- A one-off task's status on its day: done | wontDo | open | yesterday (inside the 11 PM grace) | overdue.
const at = (h: number, m = 0) => new Date(2026, 10, 28, h, m, 0); // Saturday 28 Nov
const yday = t({ id: 'y', type: 'single', date: '2026-11-27' });
const old3 = t({ id: 'o', type: 'single', date: '2026-11-25' });
assert.equal(statusOn(single, '2026-11-28', at(15)), 'open', 'today');
assert.equal(statusOn(t({ id: 'f', type: 'single', date: '2026-11-30' }), '2026-11-30', at(15)), 'open', 'a future day');
assert.equal(statusOn(yday, '2026-11-27', at(15)), 'yesterday', 'unticked, still inside the grace');
assert.equal(statusOn(yday, '2026-11-27', at(22, 59)), 'yesterday');
assert.equal(statusOn(yday, '2026-11-27', at(23, 0)), 'overdue', 'from 11 PM');
assert.equal(statusOn(old3, '2026-11-25', at(9)), 'overdue', 'older than yesterday: no grace');
assert.equal(statusOn({ ...yday, completions: ['2026-11-27'] }, '2026-11-27', at(23, 30)), 'done');

// Won't do: the task stays on its day, is no longer open or overdue, and earns or loses no XP.
const skipped = skipOn(old3, '2026-11-25');
assert.deepEqual(skipped.skipped, ['2026-11-25']);
assert.equal(skippedOn(skipped, '2026-11-25'), true);
assert.equal(statusOn(skipped, '2026-11-25', at(9)), 'wontDo');
assert.equal(showsOn(skipped, '2026-11-25'), true, 'still on its day');
assert.equal(doneOn(skipped, '2026-11-25'), false, 'not done: totals still count it as missed');
assert.deepEqual(skipped.completions, []);
// Tapping it again undoes it.
const back = skipOn(skipped, '2026-11-25');
assert.equal(statusOn(back, '2026-11-25', at(9)), 'overdue');
assert.ok(!back.skipped?.length);
// Done wins, and doing it after all clears the skip.
const doneLater = toggleOn(skipped, '2026-11-25');
assert.deepEqual([doneLater.done, doneLater.xpDelta, statusOn(doneLater.task, '2026-11-25', at(9))], [true, 25, 'done']);
assert.ok(!skippedOn(doneLater.task, '2026-11-25'), 'ticking clears the skip');
assert.equal(statusOn({ ...skipped, completions: ['2026-11-25'] }, '2026-11-25', at(9)), 'done', 'done wins over won’t do');
assert.equal(skipOn({ ...old3, completions: ['2026-11-25'] }, '2026-11-25').skipped?.length ?? 0, 0, 'a done task can’t be marked won’t do');
// A task already carried forward twice can still be marked won't do.
assert.equal(statusOn(skipOn(t({ id: 'c2', type: 'single', date: '2026-11-25', carryForwardCount: 2 }), '2026-11-25'), '2026-11-25', at(9)), 'wontDo');
// Carrying it forward moves it to the next day and clears the skip, so it doesn't arrive already dismissed.
const carried = carriedForward(skipped);
assert.deepEqual([carried.date, carried.carryForwardCount, carried.originalXp, carried.skipped?.length ?? 0], ['2026-11-26', 1, 25, 0]);
assert.equal(carriedForward({ ...carried }).originalXp, 25, 'the original XP is kept across carries');

// The Dashboard's two lists of past one-off tasks, from the real time (not midnight).
const mix = [single, yday, old3, skipped, { ...yday, id: 'yd', completions: ['2026-11-27'] }, daily, weekly, monthly];
assert.deepEqual(pastOpen(mix, at(15)), { yesterday: [yday], overdue: [old3] });
assert.deepEqual(pastOpen(mix, at(22, 59)).yesterday.map(x => x.id), ['y']);
assert.deepEqual(pastOpen(mix, at(23, 0)), { yesterday: [], overdue: [yday, old3] }, 'at 11 PM yesterday’s task becomes overdue');
// A one-off task whose date can't be read is in neither list (it used to count as overdue, where Carry forward would throw).
assert.deepEqual(pastOpen([junk, old3], at(15)), { yesterday: [], overdue: [old3] });
// Week and month XP don't move when a task is marked won't do.
const before = [weekXp([yday, old3], SAT), monthXp([yday, old3], SAT)];
assert.deepEqual([weekXp([yday, skipped], SAT), monthXp([yday, skipped], SAT)], before);
console.log('task-status: all checks passed');
