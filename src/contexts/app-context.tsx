
'use client';

import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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

interface AppContextType {
  data: AppData | null;
  loading: boolean;
  handleDataChange: (newData: AppData) => void;
  toast: ReturnType<typeof useToast>['toast'];
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
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

  const handleDataChange = (newData: AppData) => {
    if (user) {
      setData(newData);
      saveAppData(user.username, newData);
    }
  };

  return (
    <AppContext.Provider value={{ data, loading, handleDataChange, toast }}>
      {children}
    </AppContext.Provider>
  );
}
