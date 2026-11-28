// The workspace sync engine as one explicit state machine: what the screen is based on, what is unsaved, whether a
// save or the server itself is writing, and how the last load and save went. AppProvider (contexts/app-context) holds
// one SyncState and changes it only through syncStep; the network calls, the 600 ms debounce and the one-save-at-a-
// time ordering stay there. The save indicator is derived from the state (saveStatus), never set by hand, which is
// what keeps it from sticking on "Saving…" or "Not saved". Pure; checked by `npx tsx src/lib/sync-engine.check.ts`.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type SyncState<D> = {
  /** Server version (updated_at) the on-screen data is based on. Every save is conditional on it, so a stale device can't overwrite newer edits. null until the server confirms it. */
  version: string | null;
  /** Version of the device-cache copy shown before the server answers. */
  cachedVersion: string | null;
  /** Something is on screen (the cached copy or the server's). */
  hasData: boolean;
  /** The newest edit not yet sent. */
  pending: D | null;
  /** A save request is out. */
  saving: boolean;
  /** >0 while the server itself is writing the workspace (the chat's Confirm): saves wait. */
  holds: number;
  /** The last save attempt failed and its edit is still queued. */
  failed: boolean;
  /** How the last finished save ended, until the next edit: 'conflict' lasts until the reload it triggers lands. */
  outcome: 'none' | 'saved' | 'conflict';
  load: 'none' | 'pending' | 'ok' | 'failed';
  /** Bumped at every sign-out. A load or save started before it belongs to another account: its reply is dropped. */
  epoch: number;
};

export type SyncEvent<D> =
  | { type: 'cacheShown'; version: string }
  | { type: 'loadStarted' }
  | { type: 'loaded'; version: string; epoch?: number }
  | { type: 'loadFailed'; epoch?: number }
  | { type: 'edited'; data: D }
  /** The pending edit was handed to a save request (see canSave). */
  | { type: 'saveStarted' }
  | { type: 'saveSucceeded'; version: string; epoch?: number }
  /** The server has a newer version: this edit lost. */
  | { type: 'saveConflicted'; epoch?: number }
  | { type: 'saveFailed'; payload: D; epoch?: number }
  | { type: 'held' }
  | { type: 'released' }
  | { type: 'signedOut' };

/** What the provider must do after a step. */
export type SyncCmd =
  /** Save the pending edit now. */
  | 'flush'
  /** Same version: take the server copy if it differs (Fitbit numbers are merged in without a version bump). */
  | 'refresh'
  /** Changed elsewhere (or first load): the server copy replaces the screen. */
  | 'replace'
  /** Toast: the workspace changed elsewhere and the unsaved edit was dropped. */
  | 'tellChangedElsewhere'
  /** Toast: the save lost to a newer version. */
  | 'tellConflict'
  /** Load the workspace again, quietly. */
  | 'reload';

export const NEW_SYNC: SyncState<never> = { version: null, cachedVersion: null, hasData: false, pending: null, saving: false, holds: 0, failed: false, outcome: 'none', load: 'none', epoch: 0 };

/** A save can go out: there is an edit, a confirmed version to base it on, and the server isn't writing. */
export const canSave = <D,>(s: SyncState<D>) => s.pending !== null && s.version !== null && s.holds === 0;

/** What the save indicator shows. */
export function saveStatus<D>(s: SyncState<D>): SaveStatus {
  if (s.saving) return 'saving';
  if (s.pending !== null) {
    // Queued after a failure, or made on the cached copy while the server can't be reached: not saved, and say so.
    if (s.failed || (s.version === null && s.load === 'failed')) return 'error';
    return 'saving'; // debounce, waiting for the first load, or held while the server writes
  }
  return s.outcome === 'conflict' ? 'error' : s.outcome === 'saved' ? 'saved' : 'idle';
}

export function syncStep<D>(s: SyncState<D>, e: SyncEvent<D>): { state: SyncState<D>; cmds: SyncCmd[] } {
  const to = (state: SyncState<D>, ...cmds: SyncCmd[]) => ({ state, cmds });
  // A reply to something started before the last sign-out is another account's: it changes nothing here.
  if ('epoch' in e && e.epoch !== undefined && e.epoch !== s.epoch) return to(s);
  switch (e.type) {
    case 'cacheShown':
      return to({ ...s, cachedVersion: e.version, hasData: true });
    case 'loadStarted':
      return to({ ...s, load: 'pending' });
    case 'loadFailed':
      return to({ ...s, load: 'failed' });
    case 'loaded': {
      const seen = { cachedVersion: null, hasData: true, load: 'ok' as const, outcome: s.outcome === 'conflict' ? 'none' as const : s.outcome };
      if (e.version === (s.version ?? s.cachedVersion)) {
        // Unchanged elsewhere. Edits pending: keep and save them. A save still landing: leave the screen alone, or it would roll back.
        const next = { ...s, ...seen, version: e.version };
        return s.pending !== null ? to(next, 'flush') : s.saving ? to(next) : to(next, 'refresh');
      }
      // Changed on another device (or nothing was on screen): the server copy wins, an unsaved edit is dropped.
      const next = { ...s, ...seen, version: e.version, pending: null, failed: false };
      return s.pending !== null ? to(next, 'tellChangedElsewhere', 'replace') : to(next, 'replace');
    }
    case 'edited':
      return to({ ...s, pending: e.data, failed: false, outcome: 'none' });
    case 'saveStarted':
      return to({ ...s, pending: null, saving: true, failed: false });
    case 'saveSucceeded':
      return to({ ...s, saving: false, version: e.version, outcome: s.pending !== null ? s.outcome : 'saved' });
    case 'saveConflicted':
      // version null so the reload replaces the screen whatever comes back.
      return to({ ...s, saving: false, pending: null, failed: false, version: null, outcome: 'conflict' }, 'tellConflict', 'reload');
    case 'saveFailed':
      // Keep the edit queued (a newer one wins) so the next change or a refocus retries it.
      return to({ ...s, saving: false, pending: s.pending ?? e.payload, failed: true });
    case 'held':
      return to({ ...s, holds: s.holds + 1 });
    case 'released':
      return to({ ...s, holds: Math.max(0, s.holds - 1) });
    case 'signedOut':
      // Nothing unsaved, cached or in flight carries over to whoever signs in next.
      return to({ ...(NEW_SYNC as SyncState<D>), epoch: s.epoch + 1 });
  }
}

/**
 * The signed-in account went away: signed out, or replaced directly by another one (logging in while signed in).
 * Either way the engine gets 'signedOut' first, so nothing of the old account's carries over.
 */
export const accountLeft = (was: string | null, now: string | null) => was !== null && was !== now;
