// Run: npx tsx src/lib/agent-actions.check.ts — what a confirmed assistant change does to the workspace.
import assert from 'node:assert/strict';
import type { AppData } from './types';
import { AgentActionSchema, applyActions, describeAction, type AgentAction } from './agent-actions';
import { applyDraft, dayIntake } from './fitness';
import { recurringShowsOn } from './tasks';

const TODAY = '2026-11-27';
let n = 0;
const ctx = { today: TODAY, now: '2026-11-27T06:00:00.000Z', newId: () => `n${++n}` };
const base = (): AppData => applyDraft({
  tasks: [
    { id: 'gym', title: 'Gym', priority: 'Medium', type: 'recurring', completions: ['2026-11-20'], createdAt: '2026-11-01T05:00:00.000Z', ongoing: true },
    { id: 'call', title: 'Call mom', priority: 'Easy', type: 'single', completions: [], createdAt: '2026-11-27T05:00:00.000Z', date: TODAY },
  ],
  noteBoards: [{ id: 'b1', title: 'Ideas', notes: [{ id: 'note1', title: 'Trip', content: 'Goa in Jan', theme: 'yellow', position: { x: 0, y: 0 }, history: { past: [], present: { title: 'Trip', content: 'Goa in Jan' }, future: [] } }] }],
  userStats: { xp: 100 }, savedLinks: [{ id: 'l1', url: 'https://example.com', title: 'Example', summary: '', category: 'Other', dateAdded: '2026-11-01T00:00:00.000Z' }],
  journalEntries: [], logTrackers: [{ id: 'w', name: 'Weight', unit: 'kg', logs: [] }],
}, { date: TODAY, meals: [{ name: 'Rajma chawal', kcal: 450, proteinG: 15, carbsG: 70, fatG: 10, slot: 'lunch' }], activities: [{ name: 'Gym', minutes: 45, kcal: 300, stepBased: false }], values: [] }, ctx.newId);

const run = (actions: AgentAction[], d = base()) => applyActions(d, actions.map(a => AgentActionSchema.parse(a)), ctx);

// Tasks
{
  const r = run([{ type: 'task.add', title: 'Pay rent', repeat: 'monthly', priority: 'Hard' }, { type: 'task.add', title: 'Read', repeat: 'daily' }]);
  const rent = r.data.tasks.find(t => t.title === 'Pay rent')!, read = r.data.tasks.find(t => t.title === 'Read')!;
  assert.equal(rent.type, 'monthly'); assert.equal(rent.month, '2026-11'); assert.equal(rent.ongoing, true);
  assert.equal(read.type, 'recurring'); assert.equal(read.ongoing, true);
  assert.equal(r.applied.length, 2);
}
{
  const r = run([{ type: 'task.update', id: 'gym', title: 'Gym (legs)' }]);
  const [old, edited] = r.data.tasks.filter(t => t.title.startsWith('Gym'));
  assert.equal(old.endsOn, '2026-11-26', 'a repeating task is edited from today on');
  assert.equal(edited.title, 'Gym (legs)');
  assert.ok(recurringShowsOn(edited, TODAY));
}
{
  const r = run([{ type: 'task.complete', id: 'call', date: TODAY, done: true }]);
  assert.deepEqual(r.data.tasks.find(t => t.id === 'call')!.completions, [TODAY]);
  assert.ok(r.data.userStats.xp > 100, 'XP added');
  const again = run([{ type: 'task.complete', id: 'call', date: TODAY, done: true }], r.data);
  assert.equal(again.data.userStats.xp, r.data.userStats.xp, 'marking done twice changes nothing');
}
{
  const r = run([{ type: 'task.delete', id: 'gym' }]);
  const gym = r.data.tasks.find(t => t.id === 'gym')!;
  assert.equal(gym.endsOn, '2026-11-26', 'a repeating task is deleted from today on by default');
  assert.equal(run([{ type: 'task.delete', id: 'gym', everywhere: true }]).data.tasks.some(t => t.id === 'gym'), false, '"everywhere" removes it');
}

// Notes, journal, links
{
  const r = run([
    { type: 'note.add', content: 'Buy protein powder', board: 'ideas' },
    { type: 'note.update', id: 'note1', content: 'Goa in Feb' },
    { type: 'journal.write', date: TODAY, content: 'Good workout.', mood: 'Happy' },
    { type: 'journal.write', date: TODAY, content: 'Slept early.', append: true },
    { type: 'link.add', url: 'https://notora-ai.vercel.app', title: 'Notora' },
    { type: 'link.delete', id: 'l1' },
  ]);
  const notes = r.data.noteBoards[0].notes;
  assert.equal(notes[0].content, 'Buy protein powder');
  const trip = notes.find(x => x.id === 'note1')!;
  assert.equal(trip.content, 'Goa in Feb');
  assert.equal(trip.history!.past[0].content, 'Goa in Jan', 'the old text stays in undo history');
  assert.equal(r.data.journalEntries.length, 1);
  assert.equal(r.data.journalEntries[0].content, 'Good workout.\n\nSlept early.', 'appended to the same day');
  assert.equal(r.data.journalEntries[0].mood, 'Happy');
  assert.deepEqual(r.data.savedLinks.map(l => l.title), ['Notora']);
  assert.equal(run([{ type: 'note.delete', id: 'note1' }]).data.noteBoards[0].notes.length, 0);
}

// Trackers, food, workouts
{
  const d0 = base();
  const lunchId = d0.fitnessDays![TODAY].meals[0].id, gymId = d0.fitnessDays![TODAY].activities[0].id;
  const r = run([
    { type: 'tracker.log', tracker: 'weight', date: TODAY, value: 94.1 },
    { type: 'food.add', date: TODAY, meals: [{ name: 'Banana', kcal: 105, proteinG: 1, carbsG: 25, fatG: 0, slot: 'morningSnack' }] },
    { type: 'food.edit', date: TODAY, id: lunchId, name: 'Rajma chawal, 2 bowls', kcal: 900, proteinG: 30, carbsG: 140, fatG: 20 },
    { type: 'workout.delete', date: TODAY, id: gymId },
  ], d0);
  assert.equal(r.data.logTrackers.find(t => t.id === 'w')!.logs[0].value, 94.1, 'tracker found by name, any case');
  assert.deepEqual(r.data.fitnessDays![TODAY].meals.map(m => `${m.name}:${m.kcal}`), ['Rajma chawal, 2 bowls:900', 'Banana:105']);
  assert.equal(dayIntake(r.data, TODAY).kcal, 1005, 'day total follows');
  assert.equal(r.data.fitnessDays![TODAY].activities.length, 0);
  const del = run([{ type: 'food.delete', date: TODAY, id: lunchId }], d0);
  assert.equal(del.data.fitnessDays?.[TODAY]?.meals.length ?? 0, 0);
}

// Targets that no longer exist are skipped, not applied; bad input is rejected before anything runs.
{
  const r = run([{ type: 'task.delete', id: 'nope' }, { type: 'task.complete', id: 'call', date: TODAY, done: true }]);
  assert.equal(r.applied.length, 1);
  assert.equal(r.skipped.length, 1);
  assert.equal(describeAction({ type: 'food.delete', date: TODAY, id: 'nope' }, base()), null);
  assert.throws(() => AgentActionSchema.parse({ type: 'tracker.log', tracker: 'Weight', date: 'tomorrow', value: 1 }));
  assert.throws(() => AgentActionSchema.parse({ type: 'drop.everything' }));
}
console.log('agent-actions checks passed');
