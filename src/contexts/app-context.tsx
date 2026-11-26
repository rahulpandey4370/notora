
'use client';

import { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getAppData, createAppData, saveAppData } from '@/lib/storage';
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
  /** Re-fetch from the server (e.g. after a health sync). */
  reload: () => Promise<void>;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const { toast } = useToast();

  // Server version (updated_at) the on-screen data is based on; every save is
  // conditional on it so a stale device can't overwrite newer edits.
  const version = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingData = useRef<AppData | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const reportError = useCallback(async (err: any, title: string) => {
    // Production builds mask server-action error messages, so ask the server
    // directly whether the session is still valid before blaming the network.
    const signedOut = await fetch('/api/session').then(r => r.status === 401).catch(() => false);
    if (signedOut) { logout(); return; }
    const message: string = err?.message ?? '';
    const masked = !message || /Server Components render/i.test(message);
    toast({ variant: 'destructive', title, description: masked ? 'Check your connection and try again.' : message });
  }, [toast, logout]);

  const loadData = useCallback(async (opts: { quiet?: boolean; onlyIfChanged?: boolean } = {}) => {
    if (!opts.quiet) setLoading(true);
    try {
      // getAppData throws on errors; null strictly means "no row yet".
      const stored = (await getAppData()) ?? (await createAppData(freshDefaults()));
      // Refocus with nothing new elsewhere: keep the screen (and any half-typed draft) as is.
      if (opts.onlyIfChanged && stored.version === version.current) return;
      version.current = stored.version;
      setData(normalize(stored.data));
    } catch (err) {
      reportError(err, "Couldn't load your workspace");
    } finally {
      if (!opts.quiet) setLoading(false);
    }
  }, [reportError]);

  useEffect(() => {
    if (authLoading) return;
    if (user) loadData();
    else { setLoading(false); setData(null); }
  }, [user, authLoading, loadData]);

  /**
   * Persist state: debounced (a burst of edits = one write), serialised (a
   * second write waits for the first, so it is based on the new version), and
   * failures surface as a toast instead of silently losing the edit.
   */
  const flushSave = useCallback(async (): Promise<void> => {
    if (inFlight.current) { await inFlight.current; }
    if (!user || !pendingData.current || !version.current) return;
    const payload = pendingData.current;
    pendingData.current = null;
    const run = (async () => {
      setSaveState('saving');
      try {
        const result = await saveAppData(payload, version.current!);
        if (result.ok) {
          version.current = result.version;
          setSaveState(pendingData.current ? 'saving' : 'saved');
        } else {
          setSaveState('error');
          toast({
            variant: 'destructive',
            title: 'Updated on another device',
            description: 'Your workspace changed elsewhere, so it has been reloaded. Your last edit here was not saved; please redo it.',
          });
          pendingData.current = null;
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
  }, [user, toast, loadData, reportError]);

  const handleDataChange = useCallback((newData: AppData) => {
    if (!user) return;
    setData(newData);
    pendingData.current = newData;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flushSave(); }, 600);
  }, [user, flushSave]);

  // Coming back to the app (phone unlock, switching tabs): pull edits made on
  // other devices, unless this device has unsaved edits of its own.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (pendingData.current) { void flushSave(); return; }
      if (!inFlight.current) void loadData({ quiet: true, onlyIfChanged: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, flushSave, loadData]);

  const reload = useCallback(() => loadData({ quiet: true }), [loadData]);

  // Don't let a debounced write get dropped by a tab close / navigation.
  useEffect(() => {
    const flushNow = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flushSave();
    };
    window.addEventListener('beforeunload', flushNow);
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      flushNow();
    };
  }, [flushSave]);

  return (
    <AppContext.Provider value={{ data, loading, saveState, handleDataChange, toast, reload }}>
      {children}
    </AppContext.Provider>
  );
}
