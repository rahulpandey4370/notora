
'use client';

import { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { adoptOngoing } from '@/lib/tasks';
import type { Stored } from '@/lib/storage';
import { clearDeviceCache, readCache, writeCache } from '@/lib/device-cache';
import type { AppData } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { accountLeft, canSave, NEW_SYNC, saveStatus, syncStep, type SaveStatus, type SyncCmd, type SyncEvent, type SyncState } from '@/lib/sync-engine';

const defaultAppData: AppData = {
  tasks: [],
  noteBoards: [
    {
      id: 'board-1',
      title: 'General',
      notes: [
        { 
          id: 'note-1', 
          title: 'Welcome! ✨',
          content: 'This is a draggable sticky note. You can edit me or use the AI tools in the menu below.', 
          position: { x: 50, y: 50 }, 
          theme: 'yellow',
          history: { past: [], present: { title: 'Welcome! ✨', content: 'This is a draggable sticky note. You can edit me or use the AI tools in the menu below.' }, future: [] },
        },
      ]
    }
  ],
  userStats: {
    xp: 0,
  },
  savedLinks: [],
  logTrackers: [],
  journalEntries: [],
  taskTemplates: [],
  taskTemplateBundles: [],
};

type SaveState = SaveStatus;

interface AppContextType {
  data: AppData | null;
  loading: boolean;
  /** The first load failed with nothing cached to show: pages offer Retry (lib/page-gate) instead of a skeleton forever. */
  loadFailed: boolean;
  /** Load again with the skeleton showing (the Retry button). */
  retryLoad: () => void;
  /** Surfaced so the UI can show a saving/failed indicator instead of pretending every edit succeeded. */
  saveState: SaveState;
  handleDataChange: (newData: AppData) => void;
  toast: ReturnType<typeof useToast>['toast'];
  /** Re-fetch from the server (e.g. after a health sync); pending edits are saved first. */
  reload: () => Promise<void>;
  /** Run a server-side write (chat Confirm) without racing this device's saves. */
  serverWrite: <T>(fn: () => Promise<T>) => Promise<T>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

/** Fill fields older documents lack, and rebuild per-note undo history (not persisted). */
function normalize(appData: AppData): AppData {
  return {
    ...appData,
    tasks: (appData.tasks ?? []).map(t => ({ ...t, createdAt: t.createdAt || new Date().toISOString() })),
    noteBoards: (appData.noteBoards ?? []).map(b => ({
      ...b,
      notes: (b.notes ?? []).map(n => ({
        ...n,
        title: n.title || '',
        history: n.history || { past: [], present: { title: n.title || '', content: n.content }, future: [] },
      })),
    })),
    logTrackers: appData.logTrackers ?? [],
    journalEntries: appData.journalEntries ?? [],
    savedLinks: appData.savedLinks ?? [],
    taskTemplates: appData.taskTemplates ?? [],
    taskTemplateBundles: appData.taskTemplateBundles ?? [],
    userStats: appData.userStats ?? { xp: 0 },
  };
}

function freshDefaults(): AppData {
  return {
    ...defaultAppData,
    noteBoards: [{
      ...defaultAppData.noteBoards[0],
      id: uuidv4(),
      notes: [{ ...defaultAppData.noteBoards[0].notes[0], id: uuidv4() }],
    }],
  };
}

class SignedOut extends Error {}

/** Load/save go through /api/data (a route, so they never queue behind a slow AI server action). */
async function api<T>(body: unknown): Promise<T> {
  const r = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  if (r.status === 401) throw new SignedOut('signed-out');
  if (!r.ok) throw new Error(json?.error || `Request failed (${r.status})`);
  return json.result as T;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const username = user?.username ?? null;
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const { toast } = useToast();

  // The sync engine (lib/sync-engine): one state object for what the screen is based on, what is unsaved and how the
  // last load and save went. It lives in a ref because the async code below must read it the moment it changes, and
  // it changes only through `send`. The save indicator is derived from it, never set by hand.
  const sync = useRef<SyncState<AppData>>(NEW_SYNC);
  const send = useCallback((e: SyncEvent<AppData>): SyncCmd[] => {
    const { state, cmds } = syncStep(sync.current, e);
    sync.current = state;
    setSaveState(saveStatus(state));
    return cmds;
  }, []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null); // the save request that is out: the next one waits for it
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const reportError = useCallback(async (err: any, title: string) => {
    if (err instanceof SignedOut) { clearDeviceCache(); logoutRef.current(); return; }
    // Ask the server directly whether the session is still valid before blaming the network.
    const signedOut = await fetch('/api/session').then(r => r.status === 401).catch(() => false);
    if (signedOut) { clearDeviceCache(); logoutRef.current(); return; }
    const message: string = err?.message ?? '';
    const masked = !message || /Server Components render/i.test(message);
    toast({ variant: 'destructive', title, description: masked ? 'Check your connection and try again.' : message });
  }, [toast]);

  const loadData = useCallback(async (opts: { quiet?: boolean } = {}) => {
    if (!username) return;
    const epoch = sync.current.epoch; // a sign-out while this is out makes its reply another account's: dropped
    // First open on this device: paint the cached copy now, refresh behind it.
    if (!sync.current.hasData) {
      const cached = readCache(username);
      if (cached) {
        send({ type: 'cacheShown', version: cached.version });
        setData(normalize(cached.data));
        setLoading(false);
      }
    }
    if (!opts.quiet && !sync.current.hasData) setLoading(true);
    setLoadFailed(false);
    send({ type: 'loadStarted' });
    try {
      const stored = (await api<Stored | null>({ op: 'load' })) ?? (await api<Stored>({ op: 'create', data: freshDefaults() }));
      if (sync.current.epoch !== epoch) return;
      // The engine decides what a finished load means (same version or changed elsewhere, edits pending or not).
      for (const cmd of send({ type: 'loaded', version: stored.version, epoch })) {
        if (cmd === 'flush') void flushSave();
        else if (cmd === 'refresh') {
          const next = normalize(stored.data);
          // ponytail: whole-document JSON compare (~350 KB) to skip a no-op re-render. After a local edit jsonb key
          // order can differ, costing one harmless extra re-render; add a server health stamp if it shows up in profiles.
          setData(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        } else if (cmd === 'tellChangedElsewhere') {
          toast({ variant: 'destructive', title: 'Updated on another device', description: 'Your workspace changed elsewhere, so it has been refreshed. Your last edit here was not saved; please redo it.' });
        } else if (cmd === 'replace') setData(normalize(stored.data));
      }
      writeCache(username, stored);
    } catch (err) {
      if (sync.current.epoch !== epoch) return;
      send({ type: 'loadFailed', epoch });
      if (!sync.current.hasData) setLoadFailed(true); // nothing on screen to fall back on
      reportError(err, "Couldn't load your workspace");
    } finally {
      if (sync.current.epoch === epoch) setLoading(false);
    }
  }, [username, reportError, toast, send]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastUser = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading) return;
    // The account left (signed out, or another one logged in over it): nothing unsaved, cached or in flight carries
    // over, and its workspace leaves the screen before the next one loads.
    if (accountLeft(lastUser.current, username)) { send({ type: 'signedOut' }); setData(null); setLoadFailed(false); }
    lastUser.current = username;
    if (username) void loadData();
    else { setLoading(false); setLoadFailed(false); setData(null); send({ type: 'signedOut' }); }
  }, [username, authLoading, loadData, send]);

  /**
   * Persist state: debounced (a burst of edits = one write), serialised (a
   * second write waits for the first, so it is based on the new version), held
   * while the server is writing, and failures surface as a toast.
   */
  const flushSave = useCallback(async (): Promise<void> => {
    if (inFlight.current) { await inFlight.current; }
    if (!username || !canSave(sync.current)) return;
    const epoch = sync.current.epoch;
    const payload = sync.current.pending!;
    const base = sync.current.version;
    send({ type: 'saveStarted' });
    const run = (async () => {
      try {
        const result = await api<{ ok: true; version: string } | { ok: false; conflict: true }>({ op: 'save', data: payload, version: base });
        // Signed out while it was out: the reply belongs to that account. It must not touch this one's state,
        // re-queue its edit here, or re-create its device cache.
        if (sync.current.epoch !== epoch) return;
        if (result.ok) {
          send({ type: 'saveSucceeded', version: result.version, epoch });
          writeCache(username, { data: payload, version: result.version });
        } else {
          for (const cmd of send({ type: 'saveConflicted', epoch })) {
            if (cmd === 'tellConflict') {
              toast({
                variant: 'destructive',
                title: 'Updated on another device',
                description: 'Your workspace changed elsewhere, so it has been reloaded. Your last edit here was not saved; please redo it.',
              });
            } else if (cmd === 'reload') await loadData({ quiet: true });
          }
        }
      } catch (err: any) {
        if (sync.current.epoch !== epoch) return;
        // The engine keeps the edit queued so the next change or a refocus retries it.
        send({ type: 'saveFailed', payload, epoch });
        reportError(err, "Changes couldn't be saved");
      }
    })();
    inFlight.current = run;
    try { await run; } finally { if (inFlight.current === run) inFlight.current = null; }
  }, [username, toast, loadData, reportError, send]);

  const handleDataChange = useCallback((newData: AppData) => {
    if (!username) return;
    setData(newData);
    send({ type: 'edited', data: newData });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flushSave(); }, 600);
  }, [username, flushSave, send]);

  /** Write any pending edit now (before something else writes on the server). */
  const flushNow = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    await flushSave();
  }, [flushSave]);

  // One-time upgrade: recurring/monthly tasks now carry on until switched off (src/lib/tasks.ts).
  // Returns null once nothing old-style is left, so this saves at most once.
  useEffect(() => {
    if (!data || !username) return;
    const upgraded = adoptOngoing(data.tasks, format(new Date(), 'yyyy-MM-dd'));
    if (upgraded) handleDataChange({ ...data, tasks: upgraded });
  }, [data, username, handleDataChange]);

  // Coming back to the app (phone unlock, switching tabs): pull edits made on
  // other devices, after saving this device's own pending edits.
  useEffect(() => {
    if (!username) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (sync.current.pending && sync.current.version) { void flushNow(); return; }
      if (!inFlight.current) void loadData({ quiet: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [username, flushNow, loadData]);

  /** Re-fetch from the server (e.g. after a Fitbit sync), saving pending edits first so none are dropped. */
  const retryLoad = useCallback(() => { void loadData(); }, [loadData]);
  const reload = useCallback(async () => { await flushNow(); await loadData({ quiet: true }); }, [flushNow, loadData]);

  /**
   * Run something that writes the workspace on the server (the chat's Confirm):
   * pending edits are saved first, local saves wait until it's done, then the
   * result is loaded, so the two writes can't race.
   */
  const serverWrite = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    await flushNow();
    send({ type: 'held' });
    try { return await fn(); }
    finally { await loadData({ quiet: true }); send({ type: 'released' }); if (sync.current.pending) void flushSave(); }
  }, [flushNow, loadData, flushSave, send]);

  // Don't let a debounced write get dropped by a tab close / navigation.
  useEffect(() => {
    const onUnload = () => { void flushNow(); };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, [flushNow]);

  return (
    <AppContext.Provider value={{ data, loading, loadFailed, retryLoad, saveState, handleDataChange, toast, reload, serverWrite }}>
      {children}
    </AppContext.Provider>
  );
}
