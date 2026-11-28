// What to do with a Format / AI Summary reply for a journal day, once it comes back. Pure; checked by
// `npx tsx src/lib/journal-ai.check.ts`. Used by components/notora/JournalManager.

export type AiReplyFate =
  /** Save it. */
  | 'apply'
  /** The request is no longer the current one (day changed, entry deleted, page left): drop it silently. */
  | 'stale'
  /** The user changed the text meanwhile: typing wins, drop it and say so. */
  | 'edited';

export function aiReplyFate(a: {
  /** Still the latest request for the day on screen. */
  current: boolean;
  /** The entry text the AI was given. */
  sent: string;
  /** The entry text stored now; undefined when the entry is gone. */
  stored: string | undefined;
  /** The editor is open on the entry: its draft may hold typing that isn't stored yet. */
  editing: boolean;
}): AiReplyFate {
  if (!a.current || a.stored === undefined) return 'stale';
  return a.editing || a.stored !== a.sent ? 'edited' : 'apply';
}
