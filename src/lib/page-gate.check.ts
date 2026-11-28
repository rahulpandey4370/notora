// Run: npx tsx src/lib/page-gate.check.ts
import assert from 'node:assert/strict';
import { pageGate } from './page-gate';

const user = { username: 'demo' }, data = { notes: [] };
assert.equal(pageGate({ loading: true, user: null, data: null }).kind, 'loading', 'auth or data still loading');
assert.equal(pageGate({ loading: false, user: null, data: null }).kind, 'signedOut');
assert.equal(pageGate({ loading: false, user: null, data: null, loadFailed: true }).kind, 'signedOut', 'signed out wins: the page redirects to login');
// The bug: load failed, nothing cached → loading is false, data is null, and the skeleton stayed forever.
assert.equal(pageGate({ loading: false, user, data: null, loadFailed: true }).kind, 'failed');
assert.equal(pageGate({ loading: false, user, data: null }).kind, 'loading', 'signed in, no data yet, no failure: still on its way');
assert.equal(pageGate({ loading: true, user, data: null, loadFailed: true }).kind, 'loading', 'a retry in progress shows the skeleton again');
const ready = pageGate({ loading: false, user, data, loadFailed: true });
assert.equal(ready.kind, 'ready', 'data on screen (the cached copy) beats a failed refresh');
assert.ok(ready.kind === 'ready' && ready.data === data && ready.user === user);
console.log('page-gate: all checks passed');
