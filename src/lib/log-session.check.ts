// Run: npx tsx src/lib/log-session.check.ts
import assert from 'node:assert/strict';
import { logSession, NEW_SESSION, isAwaiting, type LogSession } from './log-session';
import type { FitnessDraft } from './fitness';

const DAY = '2026-11-28';
const draft = (...names: string[]): FitnessDraft => ({ date: DAY, meals: names.map(name => ({ name, kcal: 100, proteinG: 5 })), activities: [], values: [] });
const run = (s: LogSession, ...events: Parameters<typeof logSession>[1][]) => events.reduce(logSession, s);

// Typing a message and getting a reply.
let s = run(NEW_SESSION, { type: 'opened' }, { type: 'said', text: '2 rotis' }, { type: 'asked', req: 1 });
assert.ok(isAwaiting(s));
assert.deepEqual(s.msgs, [{ role: 'user', text: '2 rotis' }]);
const v0 = s.ver;
s = logSession(s, { type: 'replied', req: 1, draft: draft('2 rotis', 'Dal'), edits: [{ index: 0, kcal: 300 }], text: 'Got it.' });
assert.ok(!isAwaiting(s));
assert.deepEqual(s.draft!.meals.map(m => m.name), ['2 rotis', 'Dal']);
assert.deepEqual(s.edits, [{ index: 0, kcal: 300 }]);
assert.equal(s.msgs.at(-1)!.text, 'Got it.');
assert.equal(s.ver, v0 + 1, 'a reply re-keys the number fields so they show the new values');

// Editing a number in the draft must NOT re-key the fields (the field being typed in would lose focus and its text).
const typed = logSession(s, { type: 'draftEdited', update: d => ({ ...d, meals: d.meals.map((m, i) => (i === 0 ? { ...m, kcal: 250 } : m)) }) });
assert.equal(typed.draft!.meals[0].kcal, 250);
assert.equal(typed.ver, s.ver);
// Removing an item does re-key them, and closes the save-to-My-Foods editor (its index now points at another meal).
const editorOpen = logSession(typed, { type: 'savingMeal', index: 1 });
assert.equal(editorOpen.savingMeal, 1);
const cut = logSession(editorOpen, { type: 'draftCut', update: d => ({ ...d, meals: d.meals.filter((_, i) => i !== 0) }) });
assert.deepEqual(cut.draft!.meals.map(m => m.name), ['Dal']);
assert.equal(cut.ver, typed.ver + 1);
assert.equal(cut.savingMeal, null);

// BUG 1 (was real): closing the sheet while the AI is replying left it "Reading…" with Send disabled until a reload.
let c = run(NEW_SESSION, { type: 'opened' }, { type: 'said', text: 'poha' }, { type: 'asked', req: 7 }, { type: 'closed' });
assert.ok(!isAwaiting(c), 'closing drops the pending request');
c = logSession(c, { type: 'opened' });
assert.ok(!isAwaiting(c), 'reopened: ready to type');
assert.deepEqual([c.msgs, c.draft, c.edits, c.savingMeal], [[], null, [], null], 'reopened: a clean session');
// …and the reply that then arrives changes nothing.
const late = logSession(c, { type: 'replied', req: 7, draft: draft('Poha'), edits: [], text: 'late' });
assert.equal(late, c, 'a reply for a request that is no longer pending is ignored');
assert.equal(logSession(c, { type: 'failed', req: 7, text: 'late error' }), c);
// An older request's reply is ignored while a newer one is pending.
const newer = run(NEW_SESSION, { type: 'opened' }, { type: 'asked', req: 1 }, { type: 'asked', req: 2 });
assert.equal(logSession(newer, { type: 'replied', req: 1, draft: draft('Old'), edits: [], text: 'old' }), newer);

// BUG 2 (was real): the save-to-My-Foods editor stayed open on its index when a new reply replaced the draft.
let e = run(NEW_SESSION, { type: 'opened' }, { type: 'drafted', draft: draft('A', 'B'), text: 'first' }, { type: 'savingMeal', index: 1 }, { type: 'asked', req: 3 });
e = logSession(e, { type: 'replied', req: 3, draft: draft('C', 'D'), edits: [], text: 'second' });
assert.equal(e.savingMeal, null, 'a new draft closes the editor');
// …and a food saved for a meal that has since been replaced must not be linked to whatever is at that index now.
const linkedWrong = logSession(e, { type: 'mealLinked', index: 1, was: 'B', foodId: 'food-b' });
assert.equal(linkedWrong, e, 'the meal at that index is no longer the one that was saved');
const linked = logSession(e, { type: 'mealLinked', index: 1, was: 'D', foodId: 'food-d' });
assert.equal((linked.draft!.meals[1] as { foodId?: string }).foodId, 'food-d');

// A failed request leaves the draft alone and says so.
let f = run(NEW_SESSION, { type: 'opened' }, { type: 'drafted', draft: draft('A'), text: 'first' }, { type: 'asked', req: 4 }, { type: 'failed', req: 4, text: 'Couldn’t read that.' });
assert.ok(!isAwaiting(f));
assert.deepEqual(f.draft!.meals.map(m => m.name), ['A']);
assert.deepEqual(f.msgs.at(-1), { role: 'ai', text: 'Couldn’t read that.', error: true });

// Foods the app matched itself are added to the draft; Save empties it and keeps the conversation.
f = logSession(f, { type: 'matched', day: DAY, meals: draft('Roti').meals, text: 'From your foods.' });
assert.deepEqual(f.draft!.meals.map(m => m.name), ['A', 'Roti']);
f = run(f, { type: 'edits', edits: [{ index: 2, delete: true }] }, { type: 'editDropped', at: 0 });
assert.deepEqual(f.edits, []);
const saved = logSession(f, { type: 'saved', day: DAY, text: 'Saved ✓ Anything else?' });
assert.deepEqual([saved.draft!.meals.length, saved.edits.length, saved.savingMeal], [0, 0, null]);
assert.equal(saved.msgs.at(-1)!.text, 'Saved ✓ Anything else?');
// A note (microphone blocked, unreadable photo) is just a message.
assert.deepEqual(logSession(NEW_SESSION, { type: 'noted', text: 'The microphone is blocked.', error: true }).msgs, [{ role: 'ai', text: 'The microphone is blocked.', error: true }]);
console.log('log-session: all checks passed');
