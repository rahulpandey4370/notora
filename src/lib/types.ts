
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

export interface JournalTemplateCategory {
    category: string;
    templates: JournalTemplate[];
}
  
export const categorizedJournalTemplates: JournalTemplateCategory[] = [
    {
        category: 'Self-Discovery',
        templates: [
            { title: 'The Person I Want to Be', description: 'Describe your ideal self in detail.', content: '## My Ideal Self\n\nI want to be someone who is...\n\n### Qualities I admire:\n- \n\n### Actions I can take to become this person:\n- '},
            { title: 'My Core Values', description: 'What principles guide your life?', content: '## My Core Values\n\n1.  **Value 1:** (e.g., Honesty) - Why it\'s important to me...\n2.  **Value 2:** (e.g., Growth) - Why it\'s important to me...\n3.  **Value 3:** (e.g., Kindness) - Why it\'s important to me...\n' },
            { title: 'A Letter to My Younger Self', description: 'What advice would you give to your past self?', content: '## Dear Younger Me,\n\nI know you\'re going through a lot right now. I want you to know that...\n\n' },
            { title: 'My Fears', description: 'Acknowledge and explore your fears.', content: '## Exploring My Fears\n\n### A fear that is holding me back:\n\n\n### What is the worst that could happen?\n\n\n### How can I face this fear in a small way?\n\n' },
            { title: 'My Strengths', description: 'Celebrate what you are good at.', content: '## My Strengths\n\n### Three things I am good at:\n1. \n2. \n3. \n\n### A time I used one of these strengths successfully:\n\n' },
            { title: 'What If?', description: 'Explore possibilities without limits.', content: '## What If...\n\n### What if I couldn\'t fail?\n\n\n### What if I had unlimited resources?\n\n' },
            { title: 'My Perfect Day', description: 'Describe your ideal day from morning to night.', content: '## My Perfect Day\n\n-   **Morning:**\n-   **Afternoon:**\n-   **Evening:**\n' },
            { title: 'Childhood Memory', description: 'Describe a vivid memory from your childhood.', content: '## A Childhood Memory\n\nI remember a time when...\n\n' },
            { title: 'The Last 10 Years', description: 'Reflect on the past decade of your life.', content: '## The Last Decade\n\n### Major life events:\n- \n\n### What I\'ve learned:\n- \n' },
            { title: 'Feeling a "Full-Body Yes"', description: 'Describe a time you felt completely aligned with a decision.', content: '## Full-Body Yes\n\nI knew it was the right choice when...\n' },
        ],
    },
    {
        category: 'Relationships',
        templates: [
            { title: 'A Person I Admire', description: 'Write about someone you look up to and why.', content: '## A Person I Admire\n\nI admire [Name] because...\n' },
            { title: 'A Difficult Conversation', description: 'Plan or reflect on a challenging conversation.', content: '## A Difficult Conversation\n\n### What I want to say:\n\n\n### How I want to say it:\n\n\n### The ideal outcome:\n\n' },
            { title: 'Showing Appreciation', description: 'How can you show gratitude to someone important?', content: '## Showing Appreciation\n\nI am grateful for [Name] because...\n\nI can show my appreciation by...\n' },
            { title: 'My Social Circle', description: 'Reflect on the people you spend the most time with.', content: '## My Social Circle\n\n### Who energizes me?\n\n\n### Who drains me?\n\n' },
            { title: 'Relationship Needs', description: 'What do you need from the relationships in your life?', content: '## What I Need in a Relationship\n\nTo feel supported and happy, I need...\n' },
        ],
    },
    {
        category: 'Career & Growth',
        templates: [
            { title: 'Goal Progress Tracker', description: 'Check in on your weekly goals and track your progress.', content: '## Weekly Goal Check-in\n\n### My Top 3 Goals This Week:\n1. \n2. \n3. \n\n### Progress Made Today:\n\n\n### Blockers or Challenges:\n\n'},
            { title: 'My "Zone of Genius"', description: 'What activities make you lose track of time?', content: '## My Zone of Genius\n\nI feel most in flow when I am...\n\n' },
            { title: 'A New Skill I Want to Learn', description: 'Outline a plan to learn something new.', content: '## Learning a New Skill\n\n### The Skill:\n\n\n### First Steps to Learn It:\n1. \n2. \n' },
            { title: 'My Career Path', description: 'Where have you been, and where do you want to go?', content: '## My Career Journey\n\n### Past Roles & Lessons Learned:\n\n\n### Where I want to be in 5 years:\n\n' },
            { title: 'Wins & Lessons', description: 'Celebrate your victories and reflect on what you learned.', content: '## Today\'s Wins & Lessons\n\n### A Win (Big or Small):\n\n\n### A Lesson I Learned:\n\n'},
        ],
    },
    {
        category: 'Creativity & Ideas',
        templates: [
            { title: 'Brain Dump', description: 'Get all your thoughts out of your head and onto the page.', content: '## Brain Dump\n\n- ' },
            { title: 'Creative Writing Prompt', description: 'A starting point for a story or creative piece.', content: '## Creative Writing\n\n**Prompt:** The old clock in the town square suddenly started ticking backward...\n\n'},
            { title: 'My Next Project', description: 'Flesh out an idea for a creative project.', content: '## My Next Project\n\n### The Idea:\n\n\n### Target Audience:\n\n\n### First Steps:\n\n' },
            { title: 'Mind Map', description: 'Visually organize your thoughts around a central idea.', content: '## Mind Map: [Central Idea]\n\n-   **Main Branch 1**\n    -   Sub-point a\n    -   Sub-point b\n-   **Main Branch 2**\n' },
            { title: 'Dream Journal', description: 'Record your dreams and any thoughts or interpretations.', content: '## Dream Journal\n\n### The Dream:\n\n\n### My Interpretation/Feelings:\n\n'},
        ],
    },
    {
        category: 'Random & Fun',
        templates: [
            { title: 'My Current Favorites', description: 'List your current favorite book, movie, song, etc.', content: '## Current Favorites\n\n-   **Book:**\n-   **Movie/Show:**\n-   **Song:**\n-   **Food:**\n' },
            { title: 'If I Won the Lottery', description: 'What would you do if you suddenly had unlimited money?', content: '## If I Won the Lottery...\n\nThe first thing I would do is...\n' },
            { title: 'A Perfect Trip', description: 'Plan your dream vacation.', content: '## Dream Vacation\n\n### Destination:\n\n\n### Itinerary:\n\n' },
            { title: 'Top 5 List', description: 'Create a top 5 list of anything you want.', content: '## Top 5 [Your Topic Here]\n\n1.  \n2.  \n3.  \n4.  \n5.  \n' },
            { title: 'What I\'m Curious About', description: 'List things you want to learn more about.', content: '## Curiosity Log\n\nI\'m currently curious about...\n\n- ' },
        ],
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

    