'use client';

import { createContext, useState, useCallback, useContext, type ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { AppData, User } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { format, subDays } from 'date-fns';

const demoUser: User = {
  username: 'Demo User',
  email: 'demo@example.com',
  avatarUrl: 'https://placehold.co/100x100/A9A9A9/FFFFFF.png?text=D',
};

/** 60 days of believable fitness data for the showcase Logs page (deterministic: no Math.random). */
function demoFitness(): Pick<AppData, 'logTrackers' | 'fitnessProfile' | 'fitnessDays' | 'fitbitWorkouts'> {
  const today = new Date();
  const days = Array.from({ length: 60 }, (_, i) => ({ i, date: format(subDays(today, 59 - i), 'yyyy-MM-dd') }));
  const wave = (i: number, a: number, b = 1) => Math.sin(i * 1.7 * b) * a + Math.cos(i * 0.9 * b) * a * 0.5;
  const series = (id: string, fn: (i: number) => number | null) =>
    days.flatMap(({ i, date }) => { const v = fn(i); return v == null ? [] : [{ id: `${id}-${date}`, date, value: v }]; });
  const todayYmd = days[59].date;
  return {
    fitnessProfile: { sex: 'male', birthYear: today.getFullYear() - 31, heightCm: 176 },
    logTrackers: [
      { id: 'demo-weight', name: 'Weight', unit: 'kg', goal: 85, logs: series('w', i => (i % 3 === 2 ? null : Math.round((95 - i * 0.045 + wave(i, 0.35)) * 10) / 10)) },
      { id: 'demo-steps', name: 'Steps', unit: 'steps', goal: 10000, healthMetric: 'steps', logs: series('fitbit-steps', i => Math.round(9000 + wave(i, 2600, 1.3))) },
      { id: 'demo-protein', name: 'Protein Intake', unit: 'g', goal: 150, logs: series('p', i => (i === 59 ? null : Math.round(125 + wave(i, 22, 0.7)))) },
      { id: 'demo-intake', name: 'Daily Calorie Intake', unit: 'kcal', goal: 2200, logs: series('c', i => (i === 59 ? null : Math.round(2150 + wave(i, 280, 1.1)))) },
      { id: 'demo-burned', name: 'Calories Burned', unit: 'kcal', logs: [] },
      { id: 'demo-sleep', name: 'Sleep', unit: 'hours', goal: 8, healthMetric: 'sleep', logs: series('fitbit-sleep', i => Math.round((7 + wave(i, 0.7, 0.8)) * 10) / 10) },
      { id: 'demo-rhr', name: 'Resting heart rate', unit: 'bpm', goal: 60, healthMetric: 'restingHr', logs: series('fitbit-restingHr', i => Math.round(61 - i * 0.03 + wave(i, 1.5))) },
    ].map(t => (t.id === 'demo-protein' ? { ...t, logs: [...t.logs, { id: `auto-protein-${todayYmd}`, date: todayYmd, value: 54 }] }
      : t.id === 'demo-intake' ? { ...t, logs: [...t.logs, { id: `auto-intake-${todayYmd}`, date: todayYmd, value: 1180 }] } : t)) as AppData['logTrackers'],
    fitbitWorkouts: {
      [todayYmd]: [{ id: 'fw1', name: 'Morning walk', type: 'WALKING', minutes: 32, kcal: 150, distanceKm: 2.6, avgHr: 108, start: '07:10' }],
    },
    fitnessDays: {
      // A few earlier days, so "Same as yesterday" and the usual picks show up.
      ...Object.fromEntries([1, 2, 3, 4].map(back => [days[59 - back].date, {
        meals: [
          back % 2 ? { id: `pm-b${back}`, name: 'Oats with milk and banana', kcal: 360, proteinG: 14, carbsG: 58, fatG: 8, fiberG: 7, slot: 'breakfast' as const }
            : { id: `pm-b${back}`, name: '3 egg omelette, 2 toast', kcal: 420, proteinG: 26, carbsG: 30, fatG: 20, fiberG: 3, slot: 'breakfast' as const },
          { id: `pm-l${back}`, name: 'Steamed white rice, 150 g', kcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5, fiberG: 0.6, slot: 'lunch' as const, foodId: 'demo-rice', grams: 150 },
          { id: `pm-d${back}`, name: 'Dal tadka, 1 katori', kcal: 220, proteinG: 11, carbsG: 26, fatG: 8, fiberG: 6, slot: 'lunch' as const },
          { id: `pm-s${back}`, name: 'Whey protein × 1 (33 g)', kcal: 130, proteinG: 26, carbsG: 3, fatG: 2, fiberG: 0, slot: 'eveningSnack' as const, foodId: 'demo-whey', grams: 33 },
          { id: `pm-n${back}`, name: 'Paneer bhurji, 2 rotis', kcal: 610, proteinG: 32, carbsG: 46, fatG: 32, fiberG: 7, slot: 'dinner' as const },
        ],
        activities: [],
      }])),
      [todayYmd]: {
        meals: [
          { id: 'dm1', name: 'Poha with peanuts, 1 plate', kcal: 380, proteinG: 10, carbsG: 58, fatG: 12, fiberG: 4, slot: 'breakfast' },
          { id: 'dm2', name: '2 rotis, dal, sabzi', kcal: 640, proteinG: 26, carbsG: 88, fatG: 20, fiberG: 14, slot: 'lunch' },
          { id: 'dm3', name: 'Greek yogurt, 150 g', kcal: 160, proteinG: 18, carbsG: 8, fatG: 6, fiberG: 0, slot: 'eveningSnack' },
        ],
        activities: [
          { id: 'da1', name: 'Evening walk', minutes: 40, kcal: 190, stepBased: true },
          { id: 'da2', name: 'Strength training', minutes: 45, kcal: 260, stepBased: false },
        ],
      },
    },
  };
}

const getDefaultDemoData = (): AppData => ({
  ...demoFitness(),
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
          title: 'Welcome to the Showcase! ✨',
          content: 'This is a fully interactive demo. Feel free to add tasks, edit notes, and try the AI features. Your changes are temporary and will reset when you leave.',
          position: { x: 50, y: 50 }, 
          theme: 'yellow',
          history: { past: [], present: { title: 'Welcome to the Showcase! ✨', content: 'This is a fully interactive demo. Feel free to add tasks, edit notes, and try the AI features. Your changes are temporary and will reset when you leave.' }, future: [] }
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
  journalEntries: [
    {
        id: uuidv4(),
        date: new Date().toISOString(),
        content: `This is a sample journal entry for today. You can edit this or create new entries for any date. The editor supports Markdown for formatting!\n\n## Ideas\n- Build a cool new feature\n- Learn a new skill\n\n## Gratitude\nI'm grateful for the opportunity to learn and build things.`,
        mood: 'Happy',
    },
    {
        id: uuidv4(),
        date: subDays(new Date(), 1).toISOString(),
        content: `Yesterday was a bit challenging, but I pushed through.`,
        mood: 'Sad',
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
