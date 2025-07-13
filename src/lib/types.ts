export interface User {
  username: string;
  avatarUrl: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'Easy' | 'Medium' | 'Hard';
}

export interface StickyNote {
  id: string;
  content: string;
  position: { x: number; y: number };
  theme: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
}

export interface UserStats {
    xp: number;
}

export interface AppData {
  tasks: Task[];
  notes: StickyNote[];
  userStats: UserStats;
}
