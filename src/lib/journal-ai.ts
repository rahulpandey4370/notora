// What to do with a Format / AI Summary reply for a journal day, once it comes back. Pure; checked by
// `npx tsx src/lib/journal-ai.check.ts`. Used by components/notora/JournalManager.

export type AiReplyFate =
  /** Save it (to the entry's own day, whichever day is on screen by then). */
  | 'apply'
  /** The page was left or the entry was deleted: drop it silently. */
  | 'stale'
  /** The user changed the text meanwhile: typing wins, drop it and say so. */
  | 'edited';

export function aiReplyFate(a: {
  /** The journal page is still on screen (after it has gone, nothing can be saved safely). */
  current: boolean;
  /** The entry text the AI was given. */
  sent: string;
  /** The entry text stored now; undefined when the entry is gone. */
  stored: string | undefined;
  /** The editor is open on this entry: its draft may hold typing that isn't stored yet. */
  editing: boolean;
  /** The reply replaces the entry text (Format). A summary doesn't, so an open editor is not in its way. */
  writesText: boolean;
}): AiReplyFate {
  if (!a.current || a.stored === undefined) return 'stale';
  return a.stored !== a.sent || (a.editing && a.writesText) ? 'edited' : 'apply';
}
