// Run: npx tsx src/lib/ask.check.ts
import assert from 'node:assert/strict';
import { ask, type Ask } from './ask';

const idle: Ask<string> = { state: 'idle' };
// The normal path.
let s = ask(idle, { type: 'asked', req: 1 });
assert.deepEqual(s, { state: 'pending', req: 1 });
s = ask(s, { type: 'answered', req: 1, value: 'hello' });
assert.deepEqual(s, { state: 'ready', value: 'hello' });
// Asking again: the old answer is dropped unless the screen keeps it on show.
assert.deepEqual(ask(s, { type: 'asked', req: 2 }), { state: 'pending', req: 2 });
assert.deepEqual(ask(s, { type: 'asked', req: 2, keep: true }), { state: 'pending', req: 2, value: 'hello' });
// A failure keeps what was on show, with the error beside it.
assert.deepEqual(ask({ state: 'pending', req: 2, value: 'hello' }, { type: 'failed', req: 2, error: 'offline' }), { state: 'failed', error: 'offline', value: 'hello' });
assert.deepEqual(ask({ state: 'pending', req: 2 }, { type: 'failed', req: 2, error: 'offline' }), { state: 'failed', error: 'offline' });
// The bugs this removes: a reply to an older question, or one that arrives after the screen moved on, changes nothing.
const second: Ask<string> = { state: 'pending', req: 2 };
assert.equal(ask(second, { type: 'answered', req: 1, value: 'late' }), second, 'an older request’s answer is ignored');
assert.equal(ask(second, { type: 'failed', req: 1, error: 'late' }), second);
const moved = ask(second, { type: 'reset' });
assert.deepEqual(moved, { state: 'idle' });
assert.equal(ask(moved, { type: 'answered', req: 2, value: 'late' }), moved, 'after a reset nothing is pending, so a late answer is ignored');
assert.equal(ask({ state: 'ready', value: 'kept' } as Ask<string>, { type: 'answered', req: 9, value: 'late' }).state, 'ready');
// A value from elsewhere (a saved result, the demo) is simply shown.
assert.deepEqual(ask(idle, { type: 'set', value: 'saved' }), { state: 'ready', value: 'saved' });
assert.deepEqual(ask(second, { type: 'set', value: 'saved' }), { state: 'ready', value: 'saved' }, 'and cancels whatever was pending');
console.log('ask: all checks passed');
