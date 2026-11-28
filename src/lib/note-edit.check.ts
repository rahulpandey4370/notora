// Run: npx tsx src/lib/note-edit.check.ts
import assert from 'node:assert/strict';
import { aiReplyFate, cancelPatch, type NoteText } from './note-edit';

const sent: NoteText = { title: 'Shopping', content: 'milk eggs' };

// An AI reply is applied only to the text it was asked about. Every action reads the content; it writes the title
// ("Generate title") or the content (the rest).
assert.equal(aiReplyFate(sent, { title: 'Shopping', content: 'milk eggs' }, 'content'), 'apply');
assert.equal(aiReplyFate(sent, { title: 'Shopping', content: 'milk eggs' }, 'title'), 'apply');
// Typing wins: the bug was a reply replacing what was typed while the AI worked.
assert.equal(aiReplyFate(sent, { title: 'Shopping', content: 'milk eggs bread' }, 'content'), 'typed');
assert.equal(aiReplyFate(sent, { title: 'Shopping', content: '' }, 'content'), 'typed', 'clearing the note counts as typing');
assert.equal(aiReplyFate(sent, { title: 'Shopping', content: 'milk eggs bread' }, 'title'), 'typed', 'a title for text that has changed is stale');
assert.equal(aiReplyFate(sent, { title: 'Shopping list', content: 'milk eggs' }, 'title'), 'typed', 'a title typed meanwhile is not replaced');
// A new title is not in the way of a content reply: nothing typed is lost by applying it.
assert.equal(aiReplyFate(sent, { title: 'Shopping list', content: 'milk eggs' }, 'content'), 'apply');
// The note was deleted or left the screen: nothing to apply to, and nothing to tell the user.
assert.equal(aiReplyFate(sent, null, 'content'), 'gone');

// Cancel puts the note back as it was when editing started, even though autosave has written since.
const start: NoteText = { title: '', content: 'first draft' };
assert.deepEqual(cancelPatch(start, { title: 'Draft', content: 'first draft, more' }), start, 'autosave wrote: restore the snapshot');
assert.deepEqual(cancelPatch(start, { title: 'Draft', content: 'first draft' }), start, 'only the title was saved: still restore');
// Nothing saved since editing started (cancel within the autosave second): nothing to write, no extra undo step.
assert.equal(cancelPatch(start, { title: '', content: 'first draft' }), null);
console.log('note-edit: all checks passed');
