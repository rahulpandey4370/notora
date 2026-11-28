// Run: npx tsx src/lib/review-input.check.ts
import assert from 'node:assert/strict';
import type { AppData, Task } from './types';
import { dayEndInput, weeklyInput } from './review-input';

const TODAY = '2026-11-28'; // a Saturday; its week is Mon 23 – Sun 29
const NOW = new Date(`${TODAY}T10:00:00`);
const task = (over: Partial<Task>): Task => ({ id: 't', title: 'Read', priority: 'Medium', type: 'single', completions: [], createdAt: '', carryForwardCount: 0, ...over } as Task);

// Day End: nothing to go on until the workspace has loaded, so the dialog waits instead of saying "no tasks".
assert.equal(dayEndInput(undefined, TODAY), null);
assert.deepEqual(dayEndInput([], TODAY), []);
assert.deepEqual(dayEndInput([task({ title: 'A', completions: [TODAY] }), task({ title: 'B', completions: ['2026-11-27'] })], TODAY), ['A']);

// The key the dialogs re-ask on: the same for a save that changes nothing the summary reads, different once a tick lands.
const ticked = [task({ title: 'A', completions: [TODAY] })];
assert.equal(JSON.stringify(dayEndInput(ticked, TODAY)), JSON.stringify(dayEndInput(ticked.map(t => ({ ...t, priority: 'Hard' as const })), TODAY)));
assert.notEqual(JSON.stringify(dayEndInput([task({ title: 'A' })], TODAY)), JSON.stringify(dayEndInput(ticked, TODAY)));

// Weekly: null when nothing was logged this week.
const empty = { tasks: [], logTrackers: [], journalEntries: [] } as unknown as AppData;
assert.equal(weeklyInput(empty, NOW), null);
assert.equal(weeklyInput({ ...empty, tasks: [task({ completions: ['2026-11-20'] })] } as AppData, NOW), null); // last week's tick

const week = {
  ...empty,
  tasks: [task({ title: 'Run', priority: 'Hard', type: 'recurring', completions: ['2026-11-23', '2026-11-28', '2026-11-16'] })],
  logTrackers: [{ id: 'w', name: 'Weight', unit: 'kg', logs: [{ date: '2026-11-24', value: 80 }, { date: '2026-11-23', value: 82 }, { date: '2026-11-17', value: 84 }] }],
  journalEntries: [{ id: 'j', date: '2026-11-25T08:00:00.000Z', content: 'Good   day\nout', mood: 'happy' }, { id: 'k', date: '2026-11-10', content: 'old' }],
} as unknown as AppData;
const input = weeklyInput(week, NOW)!;
assert.equal(input.weekLabel, 'Nov 23 – Nov 29, 2026');
assert.deepEqual(input.tasks, [{ title: 'Run', priority: 'Hard', type: 'recurring', completedThisWeek: 2 }]);
assert.equal(input.totalCompletions, 2);
assert.equal(input.xpEarned, 30);
assert.equal(input.totalPossible, 2);
assert.deepEqual(input.trackers, [{ name: 'Weight', unit: 'kg', thisWeekAvg: 81, lastWeekAvg: 84, values: [{ date: '2026-11-23', value: 82 }, { date: '2026-11-24', value: 80 }] }]);
assert.deepEqual(input.journal, [{ date: '2026-11-25', mood: 'happy', tags: null, excerpt: 'Good day out' }]);

// A journal entry alone is enough to review.
assert.ok(weeklyInput({ ...empty, journalEntries: week.journalEntries } as AppData, NOW));

console.log('review-input: ok');
