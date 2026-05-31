
import { z } from "zod";

export const AZURE_MODEL_NAME = process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt-5.4';
export const modelNames = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite', AZURE_MODEL_NAME] as const;
console.log('[DEBUG types.ts] AZURE_MODEL_NAME build-time:', AZURE_MODEL_NAME, 'modelNames:', modelNames);
export type ModelId = typeof modelNames[number];

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
            { title: 'What am I avoiding?', description: 'Be honest about what you\'ve been putting off.', content: '## What I\'m Avoiding\n\nI\'ve been avoiding...\n\nBecause...\n\nOne small step I can take is...\n' },
            { title: 'How I want to feel', description: 'Instead of what you want to do, focus on how you want to feel.', content: '## How I Want to Feel\n\nThis week, I want to feel more...\n\nI can cultivate this feeling by...\n' },
            { title: 'My personal boundaries', description: 'What are your non-negotiables?', content: '## My Boundaries\n\n### A boundary I need to set or reinforce:\n\n\n### How I will communicate this boundary:\n\n' },
            { title: 'A recent challenge', description: 'Reflect on a recent obstacle and how you handled it.', content: '## A Recent Challenge\n\n### The challenge was:\n\n\n### How I responded:\n\n\n### What I would do differently next time:\n\n' },
            { title: 'What does "success" mean to me?', description: 'Define what success looks like for you, right now.', content: '## My Definition of Success\n\nSuccess to me isn\'t just about...\n\nRight now, it\'s about...\n' },
            { title: 'My inner critic', description: 'What is your inner critic saying? How can you respond?', content: '## My Inner Critic\n\n### My inner critic often tells me:\n\n\n### A compassionate response to this is:\n\n' },
            { title: 'Comfort zone', description: 'What is one thing you can do today to step outside your comfort zone?', content: '## Stepping Out\n\nMy comfort zone feels like...\n\nOne small step I can take outside of it is...\n' },
            { title: 'Lessons from failure', description: 'Describe a time you failed and what it taught you.', content: '## Lessons from Failure\n\n### The situation:\n\n\n### The lesson I learned was:\n\n' },
            { title: 'My happy place', description: 'Describe a place, real or imagined, where you feel completely at peace.', content: '## My Happy Place\n\nIt looks like...\nIt sounds like...\nIt feels like...\n' },
            { title: 'I feel most like myself when...', description: 'Complete the sentence and explore the feeling.', content: '## My True Self\n\nI feel most like myself when I am...\n\nThis is because...\n' },
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
            { title: 'Forgiveness', description: 'Is there someone (including yourself) you need to forgive?', content: '## On Forgiveness\n\nThe person I need to forgive is...\n\nWhat forgiveness would mean for me is...\n' },
            { title: 'A memory with a loved one', description: 'Describe a cherished memory with someone special.', content: '## A Cherished Memory\n\nI remember a time with [Name] when...\n' },
            { title: 'Improving a relationship', description: 'Which relationship do you want to improve, and how?', content: '## Improving a Relationship\n\nThe relationship I want to improve is with...\n\nOne thing I can do is...\n' },
            { title: 'Setting boundaries with others', description: 'Reflect on a time you needed to set a boundary.', content: '## Setting Boundaries\n\nA situation where I need to set a clearer boundary is...\n\nI can say or do...\n' },
            { title: 'Qualities of a good friend', description: 'What makes a good friend to you?', content: '## What Makes a Good Friend\n\nTo me, a good friend is someone who...\n\nI try to be this kind of friend by...\n' },
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
            { title: 'My ideal work-life balance', description: 'What does a perfectly balanced week look like?', content: '## Ideal Work-Life Balance\n\nMy ideal week involves...\n\nTo get closer to this, I can...\n' },
            { title: 'Feedback I\'ve received', description: 'Reflect on a piece of feedback you were given.', content: '## Reflecting on Feedback\n\nI recently received feedback that...\n\nMy initial reaction was...\n\nNow, I think...\n' },
            { title: 'My professional accomplishments', description: 'List career achievements you are proud of.', content: '## Professional Accomplishments\n\nI am proud of the time I...\n\nThis was significant because...\n' },
            { title: 'If I could change one thing about my job...', description: 'What would you change and why?', content: '## One Change\n\nIf I could change one thing about my work, it would be...\n\nThis would impact me by...\n' },
            { title: 'My productivity system', description: 'How do you manage your tasks and time? What\'s working?', content: '## My Productivity System\n\n### What\'s working well:\n\n\n### What could be improved:\n\n' },
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
            { title: 'A new invention', description: 'Describe an invention that solves a small, everyday problem.', content: '## My Invention\n\nThe problem is...\n\nMy invention, the [Name], solves it by...\n' },
            { title: 'Describe a color without using its name', description: 'How would you describe "red" to someone who can\'t see it?', content: '## Describing a Color\n\nIt feels like...\nIt sounds like...\nIt tastes like...\n' },
            { title: '10 ideas, no bad ones', description: 'List 10 ideas for anything - a business, a story, a trip.', content: '## 10 Quick Ideas\n\n1. \n2. \n3. \n4. \n5. \n6. \n7. \n8. \n9. \n10. \n' },
            { title: 'What inspires me', description: 'List things that are currently sparking your creativity.', content: '## Sources of Inspiration\n\n- A person: \n- A place: \n- A piece of art/music: \n- An idea: \n' },
            { title: 'Connect two unrelated things', description: 'Pick two random objects and find a connection.', content: '## Unrelated Connections\n\nObject 1: A [Your object]\nObject 2: A [Your object]\n\nHere\'s how they are connected...\n' },
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
            { title: 'If I had a superpower', description: 'What would it be and how would you use it?', content: '## My Superpower\n\nMy power would be...\n\nI would use it to...\n' },
            { title: 'My life as a movie', description: 'What genre would it be? Who would play you?', content: '## My Life: The Movie\n\nGenre: \n\nStarring: \n\nTitle: \n' },
            { title: 'A letter to an object', description: 'Write a letter to your favorite coffee mug, your car, etc.', content: '## Dear [Object],\n\nI wanted to thank you for...\n' },
            { title: 'My personal user manual', description: 'How can people best work with you?', content: '## User Manual: [Your Name]\n\n### How to best work with me:\n\n\n### What I value:\n\n\n### How I recharge:\n\n' },
            { title: 'Desert island picks', description: 'You can only bring 3 books, 3 movies, and 3 albums.', content: '## Desert Island Picks\n\n### Books:\n1. \n2. \n3. \n\n### Movies:\n1. \n2. \n3. \n\n### Albums:\n1. \n2. \n3. \n' },
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
    model?: ModelId;
}

export interface LogEntry {
    id: string;
    date: string; // 'yyyy-MM-dd'
    value: number;
    notes?: string;
    activityNotes?: string;
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
    coachResponse?: string;
    aiSummary?: string;
    model?: ModelId;
}

export interface TaskTemplate {
  id: string;
  title: string;
  priority: Task['priority'];
  type: Task['type'];
  createdAt: string;
}

export interface TaskTemplateBundle {
  id: string;
  name: string;
  templateIds: string[];
  createdAt: string;
}

export interface AppData {
  tasks: Task[];
  noteBoards: NoteBoard[];
  userStats: UserStats;
  savedLinks: SavedLink[];
  logTrackers: LogTracker[];
  journalEntries: JournalEntry[];
  taskTemplates?: TaskTemplate[];
  taskTemplateBundles?: TaskTemplateBundle[];
}
