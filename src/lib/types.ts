
import { z } from "zod";

export const linkCategories = ['Article', 'Video', 'Course', 'Image', 'Other'] as const;

export const moods = ['Ecstatic', 'Happy', 'Neutral', 'Sad', 'Angry'] as const;
export type Mood = typeof moods[number];

export const moodEmojiMap: Record<Mood, string> = {
  Ecstatic: '🤩',
  Happy: '😊',
  Neutral: '😐',
  Sad: '😢',
  Angry: '😠',
};

export interface JournalTemplate {
    title: string;
    description: string;
    content: string;
}
  
export const journalTemplates: JournalTemplate[] = [
    {
      title: 'Evening Reflection',
      description: 'Reflect on your day, acknowledging highs and lows.',
      content: '## Evening Reflection\n\n### What went well today?\n\n\n### What was challenging?\n\n\n### What can I improve tomorrow?\n\n',
    },
    {
      title: 'Gratitude Journal',
      description: 'Focus on the positive by listing things you are thankful for.',
      content: '## Gratitude\n\nI am grateful for:\n\n1. \n2. \n3. \n',
    },
    {
      title: 'Goal Progress Tracker',
      description: 'Check in on your weekly goals and track your progress.',
      content: '## Weekly Goal Check-in\n\n### My Top 3 Goals This Week:\n1. \n2. \n3. \n\n### Progress Made Today:\n\n\n### Blockers or Challenges:\n\n',
    },
    {
      title: 'Problem Solving',
      description: 'Structure your thoughts to find a solution to a challenge.',
      content: '## Problem Solving\n\n### The Problem:\n\n\n### Brainstormed Solutions:\n- \n\n### Chosen Solution & Action Steps:\n\n',
    },
    {
      title: 'Letter to Future Self',
      description: 'Write a message to yourself to be read in the future.',
      content: '## Letter to My Future Self\n\nDear Future Me,\n\nI hope when you are reading this...\n\n',
    },
    {
      title: 'Creative Writing Prompt',
      description: 'A starting point for a story or creative piece.',
      content: '## Creative Writing\n\n**Prompt:** The old clock in the town square suddenly started ticking backward...\n\n',
    },
    {
      title: 'Dream Journal',
      description: 'Record your dreams and any thoughts or interpretations.',
      content: '## Dream Journal\n\n### The Dream:\n\n\n### My Interpretation/Feelings:\n\n',
    },
    {
      title: 'Wins & Lessons',
      description: 'Celebrate your victories and reflect on what you learned.',
      content: '## Today\'s Wins & Lessons\n\n### A Win (Big or Small):\n\n\n### A Lesson I Learned:\n\n',
    },
];

export interface User {
  username: string;
  email: string;
  avatarUrl: string;
}

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(['Easy', 'Medium', 'Hard']),
  type: z.enum(['single', 'recurring', 'monthly', 'weekly']),
  completions: z.array(z.string()),
  createdAt: z.string(),
  date: z.string().optional(),
  month: z.string().optional(),
  week: z.string().optional(),
  carryForwardCount: z.number().optional(),
  originalXp: z.number().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export interface NoteHistoryState {
    title: string;
    content: string;
}

export interface NoteHistory {
    past: NoteHistoryState[];
    present: NoteHistoryState;
    future: NoteHistoryState[];
}

export interface StickyNote {
  id: string;
  title?: string;
  content: string;
  position: { x: number; y: number };
  theme: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  history?: NoteHistory;
}

export interface NoteBoard {
  id: string;
  title: string;
  notes: StickyNote[];
}

export interface UserStats {
    xp: number;
}

export interface SavedLink {
    id:string;
    url: string;
    title: string;
    summary: string;
    category: typeof linkCategories[number];
    dateAdded: string; // ISO 8601 date string
}

export interface LogEntry {
    id: string;
    date: string; // 'yyyy-MM-dd'
    value: number;
    notes?: string;
}

export interface LogTracker {
    id: string;
    name: string;
    unit: string;
    logs: LogEntry[];
    goal?: number;
    isFlippable?: boolean;
}

export interface JournalEntry {
    id: string;
    date: string; // ISO string
    content: string;
    mood?: Mood;
    tags?: string[];
}

export interface AppData {
  tasks: Task[];
  noteBoards: NoteBoard[];
  userStats: UserStats;
  savedLinks: SavedLink[];
  logTrackers: LogTracker[];
  journalEntries: JournalEntry[];
}
