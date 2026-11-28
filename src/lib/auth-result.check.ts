// Run: npx tsx src/lib/auth-result.check.ts
import assert from 'node:assert/strict';
import { loginResult } from './auth-result';

assert.deepEqual(loginResult(200), { ok: true });

// The server said no: a wrong email or password (401), or one left out (400).
assert.deepEqual(loginResult(401), { ok: false, reason: 'invalid' });
assert.deepEqual(loginResult(400), { ok: false, reason: 'invalid' });

// The server broke, or never answered (null): not the user's typing.
assert.deepEqual(loginResult(500), { ok: false, reason: 'error' });
assert.deepEqual(loginResult(502), { ok: false, reason: 'error' });
assert.deepEqual(loginResult(429), { ok: false, reason: 'error' });
assert.deepEqual(loginResult(null), { ok: false, reason: 'error' });

console.log('auth-result: all checks passed');
