
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

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AppContextType {
  data: AppData | null;
  loading: boolean;
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
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const { toast } = useToast();

  // Server version (updated_at) the on-screen data is based on; every save is
  // conditional on it so a stale device can't overwrite newer edits. null while
  // showing the device cache: nothing is saved until the server confirms it.
  const version = useRef<string | null>(null);
  const cachedVersion = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingData = useRef<AppData | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const holds = useRef(0); // >0 while the server itself is writing (chat Confirm): saves wait
  const hasData = useRef(false);
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
    // First open on this device: paint the cached copy now, refresh behind it.
    if (!hasData.current) {
      const cached = readCache(username);
      if (cached) {
        cachedVersion.current = cached.version;
        hasData.current = true;
        setData(normalize(cached.data));
        setLoading(false);
      }
    }
    if (!opts.quiet && !hasData.current) setLoading(true);
    try {
      const stored = (await api<Stored | null>({ op: 'load' })) ?? (await api<Stored>({ op: 'create', data: freshDefaults() }));
      const base = version.current ?? cachedVersion.current;
      if (stored.version === base) {
        // Nothing new elsewhere: keep the screen (and any edits made meanwhile) as is.
        version.current = stored.version;
        if (pendingData.current) void flushSave();
      } else {
        if (pendingData.current) {
          // Changed on another device while this one had unsaved edits: the server copy wins.
          pendingData.current = null;
          toast({ variant: 'destructive', title: 'Updated on another device', description: 'Your workspace changed elsewhere, so it has been refreshed. Your last edit here was not saved; please redo it.' });
        }
        version.current = stored.version;
        setData(normalize(stored.data));
      }
      cachedVersion.current = null;
      hasData.current = true;
      writeCache(username, stored);
    } catch (err) {
      reportError(err, "Couldn't load your workspace");
    } finally {
      setLoading(false);
    }
  }, [username, reportError, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authLoading) return;
    if (username) void loadData();
    else { setLoading(false); setData(null); hasData.current = false; version.current = null; }
  }, [username, authLoading, loadData]);

  /**
   * Persist state: debounced (a burst of edits = one write), serialised (a
   * second write waits for the first, so it is based on the new version), held
   * while the server is writing, and failures surface as a toast.
   */
  const flushSave = useCallback(async (): Promise<void> => {
    if (inFlight.current) { await inFlight.current; }
    if (!username || !pendingData.current || !version.current || holds.current > 0) return;
    const payload = pendingData.current;
    pendingData.current = null;
    const run = (async () => {
      setSaveState('saving');
      try {
        const result = await api<{ ok: true; version: string } | { ok: false; conflict: true }>({ op: 'save', data: payload, version: version.current });
        if (result.ok) {
          version.current = result.version;
          writeCache(username, { data: payload, version: result.version });
          setSaveState(pendingData.current ? 'saving' : 'saved');
        } else {
          setSaveState('error');
          toast({
            variant: 'destructive',
            title: 'Updated on another device',
            description: 'Your workspace changed elsewhere, so it has been reloaded. Your last edit here was not saved; please redo it.',
          });
          pendingData.current = null;
          version.current = null; // so the reload replaces the screen
          await loadData({ quiet: true });
        }
      } catch (err: any) {
        setSaveState('error');
        // Keep the edit queued so the next change or a refocus retries it.
        pendingData.current = pendingData.current ?? payload;
        reportError(err, "Changes couldn't be saved");
      }
    })();
    inFlight.current = run;
    try { await run; } finally { if (inFlight.current === run) inFlight.current = null; }
  }, [username, toast, loadData, reportError]);

  const handleDataChange = useCallback((newData: AppData) => {
    if (!username) return;
    setData(newData);
    pendingData.current = newData;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flushSave(); }, 600);
  }, [username, flushSave]);

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
      if (pendingData.current && version.current) { void flushNow(); return; }
      if (!inFlight.current) void loadData({ quiet: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [username, flushNow, loadData]);

  /** Re-fetch from the server (e.g. after a Fitbit sync), saving pending edits first so none are dropped. */
  const reload = useCallback(async () => { await flushNow(); await loadData({ quiet: true }); }, [flushNow, loadData]);

  /**
   * Run something that writes the workspace on the server (the chat's Confirm):
   * pending edits are saved first, local saves wait until it's done, then the
   * result is loaded, so the two writes can't race.
   */
  const serverWrite = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    await flushNow();
    holds.current++;
    try { return await fn(); }
    finally { await loadData({ quiet: true }); holds.current--; if (pendingData.current) void flushSave(); }
  }, [flushNow, loadData, flushSave]);

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
    <AppContext.Provider value={{ data, loading, saveState, handleDataChange, toast, reload, serverWrite }}>
      {children}
    </AppContext.Provider>
  );
}
