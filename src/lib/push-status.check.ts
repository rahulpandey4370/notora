// Run: npx tsx src/lib/push-status.check.ts
import assert from 'node:assert/strict';
import { pushStatus, refusal, type PushFacts } from './push-status';

const on: PushFacts = { supported: true, permission: 'granted', worker: true, subscribed: true, saved: true };

// "On" needs all of it: permission, a subscription on this device, and the server still sending to it.
assert.equal(pushStatus(on), 'on');
assert.equal(pushStatus({ ...on, saved: false }), 'off');
assert.equal(pushStatus({ ...on, subscribed: false, saved: false }), 'off');
assert.equal(pushStatus({ ...on, permission: 'default' }), 'off', 'not asked yet (or the prompt was dismissed): the button works');

// No push in this browser at all (an iPhone Safari tab) wins over everything.
assert.equal(pushStatus({ ...on, supported: false }), 'unsupported');
// Only a real "denied" is blocked.
assert.equal(pushStatus({ ...on, permission: 'denied' }), 'blocked');
assert.equal(pushStatus({ ...on, permission: 'denied', worker: false }), 'blocked');
// No service worker answered (off in development, still installing on a first visit): its own state, never 'loading' forever.
assert.equal(pushStatus({ ...on, worker: false, subscribed: false, saved: false }), 'unavailable');
assert.equal(pushStatus({ ...on, permission: 'default', worker: false, subscribed: false, saved: false }), 'unavailable');

// The permission prompt's answer: a dismissed prompt ('default') is not "blocked".
assert.equal(refusal('granted'), null);
assert.equal(refusal('denied'), 'blocked');
assert.equal(refusal('default'), 'off');

console.log('push-status: all checks passed');
