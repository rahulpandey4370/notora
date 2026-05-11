# **App Name**: Notora

## Core Features:

- Daily Task Management: Users can add, edit, delete, and reorder tasks for each day, with tagging by priority and task types (single, recurring, weekly, monthly).
- Task Templates & Bundles: Save reusable task definitions and group them into bundles. Each month starts with a clean slate, and templates/bundles can be added with a single click whenever needed.
- Progress Tracking: Display daily progress using a visual progress bar that resets automatically, with an option to carry forward unfinished single-day tasks (with an XP penalty).
- Gamification System: Earn XP based on task difficulty (Easy: 10 XP, Medium: 25 XP, Hard: 50 XP), tracked weekly/monthly with 'Reward Yourself' notifications. Persist user XP stats via Azure Blob Storage.
- AI Productivity Assistant: AI-powered tool suggesting better task ordering and providing a day-end summary of completed work and a motivational quote, using Genkit with Google Gemini and Azure OpenAI.
- Interactive Sticky Notes: Draggable, animated sticky notes with pastel themes and bounce/hover animations (Framer Motion), stored per-user in Azure Blob Storage.
- AI Note Tools: AI-powered tool that provides 'Polish This', 'Summarize This', 'Bullet-ify', 'Simplify', and custom transforms for refining sticky note content using Gemini.
- Journal: Markdown journal entries with mood selection, tags, templates, AI reflection, and a discovery view.
- Saved Links: Categorised link library with AI-generated summaries and AI-assisted search.
- Log Trackers: Configurable daily trackers (e.g. calories, water, steps) with goals, activity notes, and an AI calorie coach.
- Basic Login System: A two-user login flow that authenticates against a SHA-256 hashed credential list seeded from `src/lib/users.ts` into an `users.json` blob in Azure, using localStorage for session persistence. Each user's data is stored in a separate Azure blob, ensuring full isolation.

## Style Guidelines:

- Primary color: HSL (48, 100%, 62%) - A vibrant, sunny yellow (#FFDA63) to evoke energy and enthusiasm.
- Background color: HSL (48, 20%, 95%) - A very light yellow (#FAF7EF) to provide a soft, unobtrusive backdrop.
- Accent color: HSL (18, 70%, 50%) - A warm coral (#E68A59) to draw attention to key interactive elements.
- Body and headline font: 'PT Sans' (sans-serif) for a clean, modern aesthetic.
- Use playful, animated icons related to productivity and magic, reinforcing the app's theme.
- A clean, modern layout that reflects current portfolio trends from digital creative agencies
- Use subtle animations like sparkle effects for AI actions and bouncy animations for sticky notes using Framer Motion.