// One "ask the AI, show the answer" exchange as a named state, instead of busy / error / result flags that can
// disagree. Pure; checked by `npx tsx src/lib/ask.check.ts`. Components use it through hooks/use-ask.

export type Ask<T> =
  | { state: 'idle' }
  /** `value`: the previous answer, when the screen keeps it on show while the new one loads. */
  | { state: 'pending'; req: number; value?: T }
  | { state: 'ready'; value: T }
  | { state: 'failed'; error: string; value?: T };

export type AskEvent<T> =
  /** `req` is allocated by the caller (a counter), so a reply can be matched to its question. */
  | { type: 'asked'; req: number; keep?: boolean }
  | { type: 'answered'; req: number; value: T }
  | { type: 'failed'; req: number; error: string }
  /** The subject changed or the screen closed: forget it, and ignore any reply still on its way. */
  | { type: 'reset' }
  /** An answer from elsewhere: a saved result, the demo. */
  | { type: 'set'; value: T };

const shown = <T,>(s: Ask<T>): T | undefined => (s.state === 'idle' ? undefined : s.value);

export function ask<T>(s: Ask<T>, e: AskEvent<T>): Ask<T> {
  switch (e.type) {
    case 'asked': {
      const value = e.keep ? shown(s) : undefined;
      return value !== undefined ? { state: 'pending', req: e.req, value } : { state: 'pending', req: e.req };
    }
    case 'answered':
      // Only the reply to the question still pending counts: older and orphaned replies are dropped.
      return s.state === 'pending' && s.req === e.req ? { state: 'ready', value: e.value } : s;
    case 'failed':
      if (s.state !== 'pending' || s.req !== e.req) return s;
      return s.value !== undefined ? { state: 'failed', error: e.error, value: s.value } : { state: 'failed', error: e.error };
    case 'reset':
      return { state: 'idle' };
    case 'set':
      return { state: 'ready', value: e.value };
  }
}

/** What to show: the answer, or the one kept on screen while reloading / after a failure. */
export const askValue = shown;
