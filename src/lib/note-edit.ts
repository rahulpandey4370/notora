// Editing a note while autosave and the AI also write to it: the two decisions that used to be implicit.
// Pure; checked by `npx tsx src/lib/note-edit.check.ts`. Used by StickyNote and FormattedNoteCard.

export type NoteText = { title: string; content: string };

const same = (a: NoteText, b: NoteText) => a.title === b.title && a.content === b.content;

/**
 * What to do with an AI reply about a note. `sent` is the text when the AI was asked; `now` is the text on screen
 * when the reply lands (null once the note is gone); `writes` is the field the reply replaces. Typing wins: a reply
 * is dropped if the content it was made from has changed, or if it would replace something typed meanwhile.
 */
export function aiReplyFate(sent: NoteText, now: NoteText | null, writes: keyof NoteText): 'apply' | 'typed' | 'gone' {
  if (!now) return 'gone';
  return now.content === sent.content && now[writes] === sent[writes] ? 'apply' : 'typed';
}

/**
 * Cancel restores the note as it was when editing started (`start`), even if autosave has written since (`saved`).
 * Returns the text to write back, or null when nothing was saved in between.
 */
export function cancelPatch(start: NoteText, saved: NoteText): NoteText | null {
  return same(start, saved) ? null : start;
}
