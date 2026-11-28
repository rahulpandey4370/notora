// Run: npx tsx src/lib/journal-ai.check.ts
import assert from 'node:assert/strict';
import { aiReplyFate } from './journal-ai';

const base = { current: true, sent: 'my day', stored: 'my day', editing: false, writesText: true };
// The normal path: same text, nobody editing. Which day is on screen by then doesn't matter: it is saved to its own day.
assert.equal(aiReplyFate(base), 'apply');
// The page was left or the entry was deleted: dropped without a word.
assert.equal(aiReplyFate({ ...base, current: false }), 'stale');
assert.equal(aiReplyFate({ ...base, stored: undefined }), 'stale', 'a deleted entry is not written back');
assert.equal(aiReplyFate({ ...base, current: false, editing: true, stored: 'other' }), 'stale', 'stale wins: nothing to tell the user');
// Typing wins: the text was changed and saved, or the editor is open on it (its draft may be unsaved) and the reply would replace the text.
assert.equal(aiReplyFate({ ...base, stored: 'my day, edited' }), 'edited');
assert.equal(aiReplyFate({ ...base, editing: true }), 'edited');
// A summary doesn't touch the text, so an open editor is not in its way; a summary of text that has changed is still dropped.
assert.equal(aiReplyFate({ ...base, writesText: false, editing: true }), 'apply');
assert.equal(aiReplyFate({ ...base, writesText: false, stored: 'my day, edited' }), 'edited');
console.log('journal-ai: all checks passed');
