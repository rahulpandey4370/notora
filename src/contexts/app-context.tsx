
'use client';

import { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getAppData, saveAppData } from '@/lib/storage';
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
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const { toast } = useToast();

  const loadData = useCallback(async (username: string) => {
    setLoading(true);
    let appData = await getAppData(username);
    
    if (!appData) {
      console.log(`No data found for ${username}, creating default data.`);
      const newDefaultData: AppData = { 
        ...defaultAppData,
        tasks: defaultAppData.tasks.map(t => ({...t, createdAt: new Date().toISOString(), date: new Date().toISOString()})),
        noteBoards: [{
          ...defaultAppData.noteBoards[0], 
          id: uuidv4(),
          notes: [{...defaultAppData.noteBoards[0].notes[0], id: uuidv4()}] 
        }],
        savedLinks: [],
        logTrackers: [],
        journalEntries: [],
        taskTemplates: [],
        taskTemplateBundles: [],
      };
      await saveAppData(username, newDefaultData);
      appData = newDefaultData;
    } else {
      // Backwards compatibility for old data
      appData.tasks = appData.tasks.map(t => ({ ...t, createdAt: t.createdAt || new Date().toISOString() }));
      appData.noteBoards = appData.noteBoards.map(b => ({
        ...b,
        notes: b.notes.map(n => ({
          ...n, 
          title: n.title || '',
          history: n.history || { past: [], present: { title: n.title || '', content: n.content }, future: [] }
        }))
      }));
      if (!appData.logTrackers) {
        appData.logTrackers = [];
      }
      if (!appData.journalEntries) {
        appData.journalEntries = [];
      }
      if (!appData.taskTemplates) {
        appData.taskTemplates = [];
      }
      if (!appData.taskTemplateBundles) {
        appData.taskTemplateBundles = [];
      }
    }
    
    setData(appData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        loadData(user.username);
      } else {
        // Not logged in, no data to load
        setLoading(false);
        setData(null);
      }
    }
  }, [user, authLoading, loadData]);

  /**
   * Persist state.
   *
   * Two problems this solves:
   *  1. The previous implementation called `saveAppData` without `await` and
   *     without `.catch`. `saveAppData` re-throws on failure, so a failed write
   *     produced an unhandled rejection while the UI had *already* rendered the
   *     change as if it succeeded — silent data loss. Now failures surface as a
   *     toast and flip `saveState` to 'error'.
   *  2. Persistence writes the entire AppData document (hundreds of KB once you
   *     have real history) on *every* commit — each checkbox toggle, each note
   *     drag-stop. Coalescing on a short trailing debounce collapses a burst of
   *     edits into one write while keeping the UI instant.
   */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingData = useRef<AppData | null>(null);

  const flushSave = useCallback(async () => {
    if (!user || !pendingData.current) return;
    const payload = pendingData.current;
    pendingData.current = null;
    setSaveState('saving');
    try {
      await saveAppData(user.username, payload);
      setSaveState('saved');
    } catch (err: any) {
      setSaveState('error');
      toast({
        variant: 'destructive',
        title: "Changes couldn't be saved",
        description: err?.message ?? 'Your last edit is still on screen but did not reach the server. Check your connection.',
      });
    }
  }, [user, toast]);

  const handleDataChange = useCallback((newData: AppData) => {
    if (!user) return;
    setData(newData);
    pendingData.current = newData;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flushSave(); }, 600);
  }, [user, flushSave]);

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
    <AppContext.Provider value={{ data, loading, saveState, handleDataChange, toast }}>
      {children}
    </AppContext.Provider>
  );
}
