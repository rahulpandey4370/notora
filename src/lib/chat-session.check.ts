// Run: npx tsx src/lib/chat-session.check.ts
import assert from 'node:assert/strict';
import { chatSession, NEW_CHAT, isAwaiting, type ChatEvent, type ChatSession } from './chat-session';

const HI = 'Hi! I am Notora.';
const run = (s: ChatSession, ...events: ChatEvent[]) => events.reduce(chatSession, s);
const texts = (s: ChatSession) => s.messages.map(m => `${m.role}:${m.content}`);
const proposal = [{ action: { type: 'task.add', title: 'Pay rent' }, summary: 'Add task “Pay rent”' }] as any;

// Opening greets once; reopening keeps the conversation.
let s = run(NEW_CHAT, { type: 'opened', greeting: HI });
assert.deepEqual(texts(s), [`model:${HI}`]);
assert.equal(run(s, { type: 'opened', greeting: HI }).messages.length, 1);

// Ask → reply.
s = run(s, { type: 'sent', text: 'what is due today?', req: 1 });
assert.ok(isAwaiting(s));
s = run(s, { type: 'replied', req: 1, content: 'Two tasks.', modelId: 'gpt-6-luna' });
assert.ok(!isAwaiting(s));
assert.deepEqual(texts(s), [`model:${HI}`, 'user:what is due today?', 'model:Two tasks.']);
assert.equal(s.messages[2].modelId, 'gpt-6-luna');
assert.equal(new Set(s.messages.map(m => m.id)).size, 3, 'every message has its own id');

// BUG (was real): "New chat" while a reply was on its way put that reply into the new chat.
let n = run(s, { type: 'sent', text: 'and tomorrow?', req: 2 }, { type: 'newChat', greeting: HI });
assert.ok(!isAwaiting(n), 'a new chat is not waiting for the old one’s reply');
assert.deepEqual(texts(n), [`model:${HI}`]);
const late = chatSession(n, { type: 'replied', req: 2, content: 'Three tasks.' });
assert.equal(late, n, 'the old chat’s reply is dropped');
assert.equal(chatSession(n, { type: 'failed', req: 2, text: 'Sorry' }), n);
// An older request's reply is dropped while a newer one is pending.
const two = run(s, { type: 'sent', text: 'a', req: 5 }, { type: 'sent', text: 'b', req: 6 });
assert.equal(chatSession(two, { type: 'replied', req: 5, content: 'old' }), two);

// A failed request says so and frees the input.
const failed = run(s, { type: 'sent', text: 'x', req: 3 }, { type: 'failed', req: 3, text: 'Sorry, I encountered an error. Please try again.' });
assert.ok(!isAwaiting(failed));
assert.equal(failed.messages.at(-1)!.content, 'Sorry, I encountered an error. Please try again.');

// A proposed change waits for Confirm; its outcome is recorded on that message, found by id.
let p = run(s, { type: 'sent', text: 'add pay rent', req: 4 }, { type: 'replied', req: 4, content: 'I can add that.', pending: proposal });
const id = p.messages.at(-1)!.id;
assert.equal(p.messages.at(-1)!.status, 'waiting');
p = run(p, { type: 'proposal', id, status: 'applying' });
assert.equal(p.messages.at(-1)!.status, 'applying');
assert.equal(chatSession(p, { type: 'proposal', id, status: 'applying' }), p, 'Confirm twice does nothing the second time');
assert.equal(chatSession(p, { type: 'proposal', id, status: 'cancelled', result: 'Cancelled.' }), p, 'too late to cancel once it is being applied');
const applied = run(p, { type: 'proposal', id, status: 'applied', result: 'Done: 1 change saved.' });
assert.deepEqual([applied.messages.at(-1)!.status, applied.messages.at(-1)!.result], ['applied', 'Done: 1 change saved.']);
assert.equal(chatSession(applied, { type: 'proposal', id, status: 'cancelled', result: 'Cancelled.' }), applied, 'a finished proposal can’t change');
// Cancel from waiting.
const waiting = run(s, { type: 'sent', text: 'add', req: 7 }, { type: 'replied', req: 7, content: 'ok', pending: proposal });
assert.equal(run(waiting, { type: 'proposal', id: waiting.messages.at(-1)!.id, status: 'cancelled', result: 'Cancelled. Nothing was changed.' }).messages.at(-1)!.status, 'cancelled');
// BUG (was real): the outcome was written by position, so after "New chat" it landed on whatever message sat there.
const fresh = run(p, { type: 'newChat', greeting: HI }, { type: 'sent', text: 'hello', req: 8 }, { type: 'replied', req: 8, content: 'Hi again.' });
const after = chatSession(fresh, { type: 'proposal', id, status: 'applied', result: 'Done: 1 change saved.' });
assert.equal(after, fresh, 'the confirmed change is saved on the server; the new chat’s messages are left alone');
assert.ok(fresh.messages.every(m => m.id !== id), 'ids are never reused across chats');
console.log('chat-session: all checks passed');
