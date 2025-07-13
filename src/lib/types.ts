import { type linkCategories } from "@/ai/flows/analyze-link";

export interface User {
  username: string;
  avatarUrl: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'Easy' | 'Medium' | 'Hard';
  date: string; // ISO 8601 date string
}

export interface StickyNote {
  id: string;
  content: string;
  position: { x: number; y: number };
  theme: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
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
    id: string;
    url: string;
    title: string;
    summary: string;
    category: typeof linkCategories[number];
    dateAdded: string; // ISO 8601 date string
}

export interface AppData {
  tasks: Task[];
  noteBoards: NoteBoard[];
  userStats: UserStats;
  savedLinks: SavedLink[];
}
