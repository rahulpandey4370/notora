export const linkCategories = ['Article', 'Video', 'Course', 'Image', 'Other'] as const;

export interface User {
  username: string;
  avatarUrl: string;
}

export interface Task {
  id: string;
  title: string;
  priority: 'Easy' | 'Medium' | 'Hard';
  type: 'single' | 'recurring' | 'monthly';
  completions: string[]; // Array of ISO date strings 'yyyy-MM-dd'
  date?: string; // ISO 8601 date string, for single tasks
  month?: string; // 'yyyy-MM', for monthly tasks
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
