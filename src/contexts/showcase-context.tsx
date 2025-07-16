'use client';

import { createContext, useState, useCallback, useContext, type ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { AppData, User } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { format, subDays } from 'date-fns';

const demoUser: User = {
  username: 'Demo User',
  avatarUrl: 'https://placehold.co/100x100/A9A9A9/FFFFFF.png?text=D',
};

const getDefaultDemoData = (): AppData => ({
  tasks: [
    {
      id: uuidv4(),
      title: 'Check out the Dashboard page',
      priority: 'Easy',
      type: 'single',
      completions: [format(new Date(), 'yyyy-MM-dd')],
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      title: 'Explore the AI features on the Notes page',
      priority: 'Medium',
      type: 'single',
      completions: [],
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
    },
    {
        id: uuidv4(),
        title: 'Try carrying this task forward',
        priority: 'Hard',
        type: 'single',
        completions: [],
        createdAt: subDays(new Date(), 1).toISOString(),
        date: subDays(new Date(), 1).toISOString(),
        carryForwardCount: 0,
    }
  ],
  noteBoards: [
    {
      id: 'board-1',
      title: 'Demo Board',
      notes: [
        { 
          id: 'note-1', 
          content: 'Welcome to the Notora Showcase! ✨\n\nThis is a fully interactive demo. Feel free to add tasks, edit notes, and try the AI features. Your changes are temporary and will reset when you leave.',
          position: { x: 50, y: 50 }, 
          theme: 'yellow',
          width: 256,
          height: 256,
        },
      ]
    }
  ],
  userStats: {
    xp: 125,
  },
  savedLinks: [
    {
        id: uuidv4(),
        url: 'https://react.dev/',
        title: 'React - A JavaScript library for building user interfaces',
        summary: 'The official website for the React JavaScript library. Learn about components, hooks, and more.',
        category: 'Article',
        dateAdded: new Date().toISOString(),
    }
  ],
});


interface ShowcaseContextType {
  data: AppData | null;
  demoUser: User | null;
  handleDataChange: (newData: AppData) => void;
  toast: ReturnType<typeof useToast>['toast'];
}

const ShowcaseContext = createContext<ShowcaseContextType | undefined>(undefined);

export function ShowcaseProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Generate data on the client side only to prevent hydration errors
    setData(getDefaultDemoData());
  }, []);

  const handleDataChange = (newData: AppData) => {
    // In demo mode, we just update the local state. No data is saved.
    setData(newData);
  };

  return (
    <ShowcaseContext.Provider value={{ data, demoUser, handleDataChange, toast }}>
      {children}
    </ShowcaseContext.Provider>
  );
}

export function useShowcase() {
    const context = useContext(ShowcaseContext);
    if (context === undefined) {
      throw new Error('useShowcase must be used within a ShowcaseProvider');
    }
    return context;
  }
