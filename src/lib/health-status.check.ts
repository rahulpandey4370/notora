// Run: npx tsx src/lib/health-status.check.ts
import assert from 'node:assert/strict';
import { connectResult, shown } from './health-status';

// No ?health= in the URL: nothing to say.
assert.equal(connectResult(''), null);
assert.equal(connectResult('?day=2026-11-28'), null);

// Back from Google, connected: say so and reload the workspace (the first sync already ran).
assert.deepEqual(connectResult('?health=connected'), { title: 'Fitbit connected', description: undefined, reload: true });
assert.deepEqual(connectResult('?health=connected&message=Connected%2C%20but%20some%20data%20didn%27t%20sync%3A%20sleep'),
  { title: 'Fitbit connected', description: "Connected, but some data didn't sync: sleep", reload: true });

// The server has no Fitbit keys.
assert.deepEqual(connectResult('?health=not_configured'), { variant: 'destructive', title: 'Fitbit sync is not set up on the server yet', reload: false });

// Anything else is a failed connect, with the route's reason.
assert.deepEqual(connectResult('?health=error&message=Google%20sign-in%20was%20cancelled.'),
  { variant: 'destructive', title: "Couldn't connect Fitbit", description: 'Google sign-in was cancelled.', reload: false });

// Loading, failed and unavailable are three states, and none of them has anything to show.
assert.equal(shown({ state: 'loading' }), null);
assert.equal(shown({ state: 'failed' }), null);
assert.equal(shown({ state: 'unavailable' }), null);
const connected = { state: 'connected', lastSyncAt: null, lastError: null } as const;
assert.equal(shown(connected), connected);
assert.deepEqual(shown({ state: 'disconnected' }), { state: 'disconnected' });

console.log('health-status: all checks passed');
