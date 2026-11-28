// Run: npx tsx src/lib/journal-ai.check.ts
import assert from 'node:assert/strict';
import { aiReplyFate } from './journal-ai';

const base = { current: true, sent: 'my day', stored: 'my day', editing: false };
// The normal path: same day, same text, nobody editing.
assert.equal(aiReplyFate(base), 'apply');
// The day changed, the entry was deleted or the page was left: dropped without a word.
assert.equal(aiReplyFate({ ...base, current: false }), 'stale');
assert.equal(aiReplyFate({ ...base, stored: undefined }), 'stale', 'a deleted entry is not written back');
assert.equal(aiReplyFate({ ...base, current: false, editing: true, stored: 'other' }), 'stale', 'stale wins: nothing to tell the user');
// Typing wins: the text was changed and saved, or the editor is open on it (its draft may be unsaved).
assert.equal(aiReplyFate({ ...base, stored: 'my day, edited' }), 'edited');
assert.equal(aiReplyFate({ ...base, editing: true }), 'edited');
console.log('journal-ai: all checks passed');
