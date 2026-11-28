// The "Log it" AI session as one explicit state machine: the conversation, the draft waiting to be saved, and
// whether a request is out. It replaces a dozen separate flags in LogSheet that could disagree (a closed sheet
// still "busy", an editor open on a meal that had been replaced). The composer's own input (text, photo, speech)
// stays in the component. Pure; checked by `npx tsx src/lib/log-session.check.ts`.
import type { FitnessDraft } from '@/lib/fitness';
import type { LoggedMealEdit } from '@/ai/flows/parse-fitness-log';

export type LogMsg = { role: 'user' | 'ai'; text: string; image?: string; error?: boolean };

export type LogSession = {
  msgs: LogMsg[];
  /** What Save will write: new meals, workouts and tracker values. */
  draft: FitnessDraft | null;
  /** Changes to meals already logged that day, proposed by the AI. */
  edits: LoggedMealEdit[];
  /** composing: the user's turn. awaiting: a request is out; `req` is the one whose reply counts. */
  phase: { kind: 'composing' } | { kind: 'awaiting'; req: number };
  /** The draft meal whose "save to My Foods" editor is open. */
  savingMeal: number | null;
  /** Bumped whenever the draft is replaced from outside its own fields, so the (uncontrolled) number fields re-read it. */
  ver: number;
};

export type LogEvent =
  | { type: 'opened' }
  /** The sheet closed: whatever request is out no longer counts. */
  | { type: 'closed' }
  | { type: 'said'; text: string; image?: string }
  /** A request went out. `req` comes from the caller's counter. */
  | { type: 'asked'; req: number }
  | { type: 'replied'; req: number; draft: FitnessDraft; edits: LoggedMealEdit[]; text: string }
  | { type: 'failed'; req: number; text: string }
  /** Foods the app matched itself (no AI): added to the draft. */
  | { type: 'matched'; day: string; meals: FitnessDraft['meals']; text: string }
  /** A whole draft from somewhere other than a request (the demo). */
  | { type: 'drafted'; draft: FitnessDraft; text: string }
  /** A message from the app: microphone blocked, unreadable photo. */
  | { type: 'noted'; text: string; error?: boolean }
  /** A number or meal slot typed into the draft. */
  | { type: 'draftEdited'; update: (d: FitnessDraft) => FitnessDraft }
  /** An item removed from the draft. */
  | { type: 'draftCut'; update: (d: FitnessDraft) => FitnessDraft }
  | { type: 'edits'; edits: LoggedMealEdit[] }
  | { type: 'editDropped'; at: number }
  | { type: 'savingMeal'; index: number | null }
  /** A draft meal was saved to My Foods. `was` is its name when the save started: if another meal is there now, nothing is linked. */
  | { type: 'mealLinked'; index: number; was: string; foodId: string }
  | { type: 'saved'; day: string; text: string };

const empty = (date: string): FitnessDraft => ({ date, meals: [], activities: [], values: [] });
const say = (s: LogSession, text: string, error?: boolean): LogMsg[] => [...s.msgs, error ? { role: 'ai', text, error: true } : { role: 'ai', text }];

export const NEW_SESSION: LogSession = { msgs: [], draft: null, edits: [], phase: { kind: 'composing' }, savingMeal: null, ver: 0 };
export const isAwaiting = (s: LogSession) => s.phase.kind === 'awaiting';
/** Only the reply to the request still out counts: older ones, and ones from a sheet since closed, are dropped. */
const answers = (s: LogSession, req: number) => s.phase.kind === 'awaiting' && s.phase.req === req;

export function logSession(s: LogSession, e: LogEvent): LogSession {
  switch (e.type) {
    case 'opened':
      return { ...NEW_SESSION, ver: s.ver + 1 };
    case 'closed':
      return s.phase.kind === 'awaiting' ? { ...s, phase: { kind: 'composing' } } : s;
    case 'said':
      return { ...s, msgs: [...s.msgs, { role: 'user', text: e.text, ...(e.image ? { image: e.image } : {}) }] };
    case 'asked':
      return { ...s, phase: { kind: 'awaiting', req: e.req } };
    case 'replied':
      if (!answers(s, e.req)) return s;
      return { ...s, phase: { kind: 'composing' }, draft: e.draft, edits: e.edits, msgs: say(s, e.text), savingMeal: null, ver: s.ver + 1 };
    case 'failed':
      if (!answers(s, e.req)) return s;
      return { ...s, phase: { kind: 'composing' }, msgs: say(s, e.text, true) };
    case 'matched':
      return { ...s, draft: { ...(s.draft ?? empty(e.day)), date: s.draft?.date ?? e.day, meals: [...(s.draft?.meals ?? []), ...e.meals] }, msgs: say(s, e.text), ver: s.ver + 1 };
    case 'drafted':
      return { ...s, draft: e.draft, msgs: say(s, e.text), savingMeal: null, ver: s.ver + 1 };
    case 'noted':
      return { ...s, msgs: say(s, e.text, e.error) };
    case 'draftEdited':
      return s.draft ? { ...s, draft: e.update(s.draft) } : s;
    case 'draftCut':
      // Indexes shift, so an open save-to-My-Foods editor would point at a different meal: close it.
      return s.draft ? { ...s, draft: e.update(s.draft), savingMeal: null, ver: s.ver + 1 } : s;
    case 'edits':
      return { ...s, edits: e.edits };
    case 'editDropped':
      return { ...s, edits: s.edits.filter((_, i) => i !== e.at) };
    case 'savingMeal':
      return { ...s, savingMeal: e.index };
    case 'mealLinked': {
      if (s.draft?.meals[e.index]?.name !== e.was) return s;
      return { ...s, draft: { ...s.draft, meals: s.draft.meals.map((m, i) => (i === e.index ? { ...m, foodId: e.foodId } : m)) }, savingMeal: s.savingMeal === e.index ? null : s.savingMeal };
    }
    case 'saved':
      return { ...s, draft: empty(e.day), edits: [], msgs: say(s, e.text), savingMeal: null };
  }
}
