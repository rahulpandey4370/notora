// Run: npx tsx src/lib/tasks.check.ts — which days recurring and monthly tasks show on.
import assert from 'node:assert/strict';
import type { Task } from './types';
import { adoptOngoing, deleteFrom, editFrom, isRepeating, monthlyShowsIn, recurringShowsOn, resumeRepeating, stopRepeating, repeatState } from './tasks';

const rec = (extra: Partial<Task> = {}): Task => ({ id: 'r', title: 'Gym', priority: 'Medium', type: 'recurring', completions: [], createdAt: '2026-10-05T09:00:00.000Z', ...extra });
const mon = (month: string, extra: Partial<Task> = {}): Task => ({ id: `m-${month}`, title: 'Pay rent', priority: 'Easy', type: 'monthly', completions: [], createdAt: `${month}-01T09:00:00.000Z`, month, ...extra });
const start = '2026-10-05';

// Old-style tasks keep the old rule: only the month they were created in.
assert.equal(recurringShowsOn(rec(), '2026-10-04', start), false, 'not before it was created');
assert.equal(recurringShowsOn(rec(), '2026-10-31', start), true);
assert.equal(recurringShowsOn(rec(), '2026-11-01', start), false, 'legacy: creation month only');
assert.equal(monthlyShowsIn(mon('2026-10'), '2026-11'), false, 'legacy monthly: its month only');

// Ongoing tasks repeat until stopped, and stay on the days before.
const on = rec({ ongoing: true });
assert.equal(recurringShowsOn(on, '2027-03-14', start), true, 'ongoing: every day after it starts');
const stopped = stopRepeating(on, '2026-11-26');
assert.equal(recurringShowsOn(stopped, '2026-11-26', start), true, 'still there today');
assert.equal(recurringShowsOn(stopped, '2026-11-27', start), false, 'gone from tomorrow');
assert.equal(recurringShowsOn(stopped, '2026-10-20', start), true, 'earlier days keep it');
assert.equal(recurringShowsOn(resumeRepeating(stopped), '2026-12-01', start), true, 'switching it back on resumes');
assert.equal(isRepeating(stopped), false, 'switched off the same day reads as off');
assert.equal(isRepeating(resumeRepeating(stopped)), true);

const monOn = mon('2026-10', { ongoing: true });
assert.equal(monthlyShowsIn(monOn, '2026-09'), false);
assert.equal(monthlyShowsIn(monOn, '2027-01'), true, 'ongoing monthly: every month after');
const monStopped = stopRepeating(monOn, '2026-11-26');
assert.equal(monthlyShowsIn(monStopped, '2026-11'), true, 'still this month');
assert.equal(monthlyShowsIn(monStopped, '2026-12'), false, 'gone from next month');

// One-time upgrade: the latest copy of each re-added task carries on, older copies keep their own month.
{
  const tasks: Task[] = [
    rec({ id: 'gym-oct', createdAt: '2026-10-01T08:00:00.000Z' }),
    rec({ id: 'gym-nov', title: ' gym ', createdAt: '2026-11-01T08:00:00.000Z' }),
    rec({ id: 'yoga-aug', title: 'Yoga', createdAt: '2026-08-01T08:00:00.000Z' }),
    mon('2026-10', { id: 'rent-oct' }), mon('2026-11', { id: 'rent-nov' }),
    { id: 's', title: 'One-off', priority: 'Easy', type: 'single', completions: [], createdAt: '2026-11-02T00:00:00.000Z', date: '2026-11-02' },
  ];
  const out = adoptOngoing(tasks, '2026-11-26')!;
  const by = (id: string) => out.find(t => t.id === id)!;
  assert.equal(by('gym-nov').ongoing, true, 'this month\'s copy carries on');
  assert.equal(by('gym-oct').ongoing, false, 'the older copy stays in October');
  assert.equal(by('yoga-aug').ongoing, false, 'a task you stopped re-adding is not revived');
  assert.equal(by('rent-nov').ongoing, true);
  assert.equal(by('rent-oct').ongoing, false);
  assert.equal(by('s').ongoing, undefined, 'single tasks untouched');
  assert.equal(adoptOngoing(out, '2026-11-26'), null, 'runs once: nothing left to upgrade');
}
// Editing from today: past days keep the old task and ticks, the edit applies from today.
{
  const old = rec({ id: 'gym', ongoing: true, completions: ['2026-11-20', '2026-11-25', '2026-11-26'] });
  const out = editFrom(old, { title: 'Gym (legs)', priority: 'Hard' }, '2026-11-26', () => 'gym2');
  assert.equal(out.length, 2);
  const [before, after] = out;
  assert.equal(before.title, 'Gym', 'the old task keeps its title');
  assert.equal(before.endsOn, '2026-11-25', 'and ends yesterday');
  assert.deepEqual(before.completions, ['2026-11-20', '2026-11-25'], 'past ticks stay');
  assert.equal(after.id, 'gym2');
  assert.equal(after.title, 'Gym (legs)');
  assert.equal(after.priority, 'Hard');
  assert.equal(after.startsOn, '2026-11-26');
  assert.deepEqual(after.completions, ['2026-11-26'], "today's tick moves to the edited task");
  assert.equal(recurringShowsOn(after, '2026-11-25'), false, 'the edit is not shown on earlier days');
  assert.equal(recurringShowsOn(after, '2027-01-10'), true, 'and carries on');
  assert.equal(recurringShowsOn(before, '2026-11-26', start), false, 'the old one is gone from today');

  const fresh = rec({ id: 'new', ongoing: true, createdAt: '2026-11-26T05:00:00.000Z' });
  const same = editFrom(fresh, { title: 'Walk' }, '2026-11-26', () => 'x');
  assert.equal(same.length, 1, 'a task that starts today is edited in place');
  assert.equal(same[0].title, 'Walk');

  const rent = mon('2026-09', { ongoing: true, completions: ['2026-10-01', '2026-11-01'] });
  const [r0, r1] = editFrom(rent, { title: 'Pay rent + maintenance' }, '2026-11-26', () => 'rent2');
  assert.equal(r0.endsOn, '2026-10-31', 'monthly: the old one ends last month');
  assert.deepEqual(r0.completions, ['2026-10-01']);
  assert.equal(r1.month, '2026-11');
  assert.deepEqual(r1.completions, ['2026-11-01']);
}

// Deleting from today: gone today onwards, earlier days and ticks kept.
{
  const old = rec({ id: 'gym', ongoing: true, completions: ['2026-11-20', '2026-11-26'] });
  const { task, removed } = deleteFrom(old, '2026-11-26');
  assert.equal(task!.endsOn, '2026-11-25');
  assert.deepEqual(task!.completions, ['2026-11-20']);
  assert.equal(removed, 1, "today's tick is removed (and its XP)");
  assert.equal(recurringShowsOn(task!, '2026-11-26', start), false);
  assert.equal(recurringShowsOn(task!, '2026-11-20', start), true);
  assert.equal(deleteFrom(rec({ ongoing: true, createdAt: '2026-11-26T05:00:00.000Z' }), '2026-11-26').task, null, 'no history: removed outright');
}

// The repeating lifecycle as one named value (it was read off `ongoing`, `endsOn` and the type in several places).
{
  const base = { id: 'x', title: 'X', priority: 'Easy' as const, completions: [], createdAt: '2026-11-01T08:00:00.000Z' };
  assert.equal(repeatState({ ...base, type: 'single', date: '2026-11-02' }), 'oneOff');
  assert.equal(repeatState({ ...base, type: 'weekly', week: '2026-48' }), 'oneOff');
  assert.equal(repeatState({ ...base, type: 'recurring' }), 'legacy', 'before the one-time upgrade: treated as bound to its month');
  assert.equal(repeatState({ ...base, type: 'recurring', ongoing: false }), 'monthBound');
  assert.equal(repeatState({ ...base, type: 'monthly', month: '2026-11', ongoing: true }), 'repeating');
  assert.equal(repeatState({ ...base, type: 'recurring', ongoing: true, endsOn: '2026-11-20' }), 'stopped');
  assert.equal(repeatState({ ...base, type: 'recurring', ongoing: false, endsOn: '2026-11-20' }), 'monthBound', 'a contradictory pair reads as not repeating');
  for (const t of [{ ...base, type: 'recurring' as const, ongoing: true }, { ...base, type: 'recurring' as const, ongoing: true, endsOn: '2026-11-20' }, { ...base, type: 'single' as const }])
    assert.equal(isRepeating(t), repeatState(t) === 'repeating');
}
console.log('tasks checks passed');
