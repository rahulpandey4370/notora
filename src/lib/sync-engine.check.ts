// Run: npx tsx src/lib/sync-engine.check.ts
import assert from 'node:assert/strict';
import { accountLeft, canSave, NEW_SYNC, saveStatus, syncStep, type SyncEvent, type SyncState } from './sync-engine';

type S = SyncState<string>;
const run = (s: S, ...events: SyncEvent<string>[]) => events.reduce((x, e) => syncStep(x, e).state, s);
const cmds = (s: S, e: SyncEvent<string>) => syncStep(s, e).cmds;
const booted = run(NEW_SYNC as S, { type: 'loadStarted' }, { type: 'loaded', version: 'v1' });

// A fresh load shows the server copy and nothing is unsaved.
assert.deepEqual(cmds(run(NEW_SYNC as S, { type: 'loadStarted' }), { type: 'loaded', version: 'v1' }), ['replace']);
assert.equal(saveStatus(booted), 'idle');
assert.equal(booted.version, 'v1');

// Edit → save → saved.
let s = run(booted, { type: 'edited', data: 'e1' });
assert.equal(saveStatus(s), 'saving');
assert.ok(canSave(s));
s = run(s, { type: 'saveStarted' });
assert.deepEqual([s.pending, s.saving, canSave(s)], [null, true, false]);
s = run(s, { type: 'saveSucceeded', version: 'v2' });
assert.deepEqual([saveStatus(s), s.version, s.saving], ['saved', 'v2', false]);
// A quiet reload afterwards must not re-announce "Saved".
assert.equal(saveStatus(run(s, { type: 'loadStarted' }, { type: 'loaded', version: 'v2' })), 'saved');

// An edit while a save is out: still "saving" when the first lands, and the next save is based on the new version.
s = run(booted, { type: 'edited', data: 'e1' }, { type: 'saveStarted' }, { type: 'edited', data: 'e2' }, { type: 'saveSucceeded', version: 'v2' });
assert.deepEqual([saveStatus(s), s.pending, s.version, canSave(s)], ['saving', 'e2', 'v2', true]);

// A failed save keeps the edit queued (the newest one, if there is a newer) and says "not saved".
const failed = run(booted, { type: 'edited', data: 'e1' }, { type: 'saveStarted' }, { type: 'saveFailed', payload: 'e1' });
assert.deepEqual([saveStatus(failed), failed.pending, canSave(failed)], ['error', 'e1', true]);
const newer = run(booted, { type: 'edited', data: 'e1' }, { type: 'saveStarted' }, { type: 'edited', data: 'e2' }, { type: 'saveFailed', payload: 'e1' });
assert.equal(newer.pending, 'e2', 'a newer edit is not replaced by the failed older one');
assert.equal(saveStatus(run(failed, { type: 'edited', data: 'e2' })), 'saving', 'the next edit tries again');
assert.equal(saveStatus(run(failed, { type: 'saveStarted' })), 'saving', 'so does a retry');

// Nothing is saved without a confirmed version, while the server is writing, or with nothing to save.
assert.ok(!canSave(run(NEW_SYNC as S, { type: 'cacheShown', version: 'v1' }, { type: 'edited', data: 'e1' })), 'showing the cached copy: not yet');
assert.ok(!canSave(run(booted, { type: 'held' }, { type: 'edited', data: 'e1' })));
assert.ok(canSave(run(booted, { type: 'held' }, { type: 'edited', data: 'e1' }, { type: 'released' })));
assert.ok(!canSave(booted));

// What a finished load does. Same version as on screen: save what is pending, else refresh (Fitbit numbers) unless a save is landing.
assert.deepEqual(cmds(run(booted, { type: 'loadStarted' }), { type: 'loaded', version: 'v1' }), ['refresh']);
assert.deepEqual(cmds(run(booted, { type: 'edited', data: 'e1' }, { type: 'loadStarted' }), { type: 'loaded', version: 'v1' }), ['flush']);
assert.deepEqual(cmds(run(booted, { type: 'edited', data: 'e1' }, { type: 'saveStarted' }, { type: 'loadStarted' }), { type: 'loaded', version: 'v1' }), []);
// Changed elsewhere: the server copy replaces the screen; an unsaved edit is dropped and the user is told.
assert.deepEqual(cmds(run(booted, { type: 'loadStarted' }), { type: 'loaded', version: 'v9' }), ['replace']);
const dropped = syncStep(run(booted, { type: 'edited', data: 'e1' }, { type: 'loadStarted' }), { type: 'loaded', version: 'v9' });
assert.deepEqual(dropped.cmds, ['tellChangedElsewhere', 'replace']);
assert.deepEqual([dropped.state.pending, dropped.state.version], [null, 'v9']);
// BUG A (was real): the indicator stayed on "Saving…" for good after that edit was dropped.
assert.equal(saveStatus(dropped.state), 'idle');
// …also when the edit that was dropped followed an earlier successful save: no stray "Saved".
const afterSave = run(booted, { type: 'edited', data: 'e1' }, { type: 'saveStarted' }, { type: 'saveSucceeded', version: 'v2' }, { type: 'edited', data: 'e2' }, { type: 'loadStarted' }, { type: 'loaded', version: 'v9' });
assert.equal(saveStatus(afterSave), 'idle');

// A conflict: the edit is gone, the user is told, the workspace is reloaded.
const conflict = syncStep(run(booted, { type: 'edited', data: 'e1' }, { type: 'saveStarted' }), { type: 'saveConflicted' });
assert.deepEqual(conflict.cmds, ['tellConflict', 'reload']);
assert.deepEqual([conflict.state.pending, conflict.state.version, saveStatus(conflict.state)], [null, null, 'error']);
// BUG B (was real): the reload succeeded but the indicator stayed on "Not saved".
const reloaded = syncStep(run(conflict.state, { type: 'loadStarted' }), { type: 'loaded', version: 'v9' });
assert.deepEqual([reloaded.cmds, saveStatus(reloaded.state)], [['replace'], 'idle']);

// The cached copy is shown first; the server's confirms it (same version) or replaces it.
const cached = run(NEW_SYNC as S, { type: 'cacheShown', version: 'v1' }, { type: 'loadStarted' });
assert.ok(cached.hasData);
assert.deepEqual(cmds(cached, { type: 'loaded', version: 'v1' }), ['refresh']);
assert.deepEqual(cmds(cached, { type: 'loaded', version: 'v2' }), ['replace']);
assert.deepEqual(cmds(run(cached, { type: 'edited', data: 'e1' }), { type: 'loaded', version: 'v1' }), ['flush'], 'an edit made on the cached copy is saved once the version is confirmed');
assert.equal(saveStatus(run(cached, { type: 'edited', data: 'e1' })), 'saving', 'while the load is still on its way: it will be saved');
// BUG C (was real): offline with the cached copy on screen, an edit read "Saving…" indefinitely.
const offline = run(cached, { type: 'loadFailed' }, { type: 'edited', data: 'e1' });
assert.equal(saveStatus(offline), 'error', 'not saved, and it says so');
assert.equal(saveStatus(run(offline, { type: 'loadStarted' })), 'saving', 'trying again');
assert.deepEqual(cmds(run(offline, { type: 'loadStarted' }), { type: 'loaded', version: 'v1' }), ['flush']);

// BUG D (was real, reproduced in the app): a save still out at sign-out that failed after the next person signed in
// was re-queued, and then written into THEIR workspace. Replies from before a sign-out are dropped.
const a = run(booted, { type: 'edited', data: 'account-a-edit' }, { type: 'saveStarted' });
const epochA = a.epoch;
const b = run(a, { type: 'signedOut' }, { type: 'loadStarted' }, { type: 'loaded', version: 'b1' });
assert.deepEqual([b.pending, b.saving, b.version], [null, false, 'b1'], 'signing out forgets everything unsaved');
const late = syncStep(b, { type: 'saveFailed', payload: 'account-a-edit', epoch: epochA });
assert.equal(late.state, b, 'the old account’s failed save changes nothing');
assert.ok(!canSave(late.state));
assert.equal(syncStep(b, { type: 'saveSucceeded', version: 'a2', epoch: epochA }).state, b, 'nor does its late success (the version is the other account’s)');
assert.equal(syncStep(b, { type: 'loaded', version: 'a1', epoch: epochA }).state, b, 'nor a late load');
assert.deepEqual(syncStep(b, { type: 'loaded', version: 'a1', epoch: epochA }).cmds, []);
assert.equal(syncStep(b, { type: 'saveConflicted', epoch: epochA }).cmds.length, 0);
// Replies from the current sign-in carry its epoch and count.
assert.equal(syncStep(run(b, { type: 'edited', data: 'e' }, { type: 'saveStarted' }), { type: 'saveSucceeded', version: 'b2', epoch: b.epoch }).state.version, 'b2');
// Logging in as someone else without signing out first (the login page allows it) is a sign-out for the engine too:
// account A's unsaved edit and in-flight save must not carry over to B.
assert.equal(accountLeft('a', null), true, 'signed out');
assert.equal(accountLeft('a', 'b'), true, 'replaced directly by another account');
assert.equal(accountLeft('a', 'a'), false);
assert.equal(accountLeft(null, 'a'), false, 'first sign-in: nothing to forget');
assert.equal(accountLeft(null, null), false);
console.log('sync-engine: all checks passed');
