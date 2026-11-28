'use client';

import { useCallback, useReducer, useRef } from 'react';
import { ask, askValue, type Ask, type AskEvent } from '@/lib/ask';

/**
 * One AI exchange for a component (lib/ask): `run` asks, and only the latest question's reply is shown, so a slow
 * reply can't land after the screen moved on. `run` resolves to the value only if it was applied (else undefined),
 * for follow-up work such as saving it.
 */
export function useAsk<T>() {
  const [state, dispatch] = useReducer(ask as (s: Ask<T>, e: AskEvent<T>) => Ask<T>, { state: 'idle' } as Ask<T>);
  const last = useRef(0); // request ids are made here, not in the reducer (reducers may run twice in dev)
  const run = useCallback(async (fn: () => Promise<T>, opts: { keep?: boolean; error?: string | ((err: unknown) => string) } = {}): Promise<T | undefined> => {
    const req = ++last.current;
    dispatch({ type: 'asked', req, keep: opts.keep });
    try {
      const value = await fn();
      if (req !== last.current) return undefined;
      dispatch({ type: 'answered', req, value });
      return value;
    } catch (err) {
      if (req === last.current) dispatch({ type: 'failed', req, error: typeof opts.error === 'function' ? opts.error(err) : opts.error ?? 'Something went wrong. Try again.' });
      return undefined;
    }
  }, []);
  const reset = useCallback(() => { last.current++; dispatch({ type: 'reset' }); }, []);
  const set = useCallback((value: T) => { last.current++; dispatch({ type: 'set', value }); }, []);
  return { state, value: askValue(state), pending: state.state === 'pending', error: state.state === 'failed' ? state.error : '', run, reset, set };
}
