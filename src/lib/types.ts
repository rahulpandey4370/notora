
import { z } from "zod";

export const linkCategories = ['Article', 'Video', 'Course', 'Image', 'Other'] as const;

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
}

export interface AppData {
  tasks: Task[];
  noteBoards: NoteBoard[];
  userStats: UserStats;
  savedLinks: SavedLink[];
  logTrackers: LogTracker[];
  journalEntries: JournalEntry[];
}
