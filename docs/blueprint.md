# **App Name**: Notora

## Core Features:

- Daily Task Management: Users can add, edit, delete, and reorder tasks for each day, with tagging by priority or category.
- Progress Tracking: Display daily progress using a visual progress bar that resets automatically, with an option to carry forward unfinished tasks.
- Gamification System: Earn XP based on task difficulty (Easy: 10 XP, Medium: 25 XP, Hard: 50 XP), tracked weekly/monthly with 'Reward Yourself' notifications. Persist user XP stats via Vercel Blob storage.
- AI Productivity Assistant: AI-powered tool suggesting better task ordering and providing a day-end summary of completed work and a motivational quote, using Firebase Genkit and Gemini.
- Interactive Sticky Notes: Draggable, animated sticky notes with pastel themes and bounce/hover animations (Framer Motion), stored using Vercel Blob.
- AI Note Tools: AI-powered tool that provides 'Polish This', 'Summarize This', 'Bullet-ify' or 'Simplify' options for refining sticky note content using Gemini.
- Basic Login System: A basic login system that authenticates two users against a local TypeScript file, using localStorage for session persistence.

## Style Guidelines:

- Primary color: HSL (48, 100%, 62%) - A vibrant, sunny yellow (#FFDA63) to evoke energy and enthusiasm.
- Background color: HSL (48, 20%, 95%) - A very light yellow (#FAF7EF) to provide a soft, unobtrusive backdrop.
- Accent color: HSL (18, 70%, 50%) - A warm coral (#E68A59) to draw attention to key interactive elements.
- Body and headline font: 'PT Sans' (sans-serif) for a clean, modern aesthetic.
- Use playful, animated icons related to productivity and magic, reinforcing the app's theme.
- A clean, modern layout that reflects current portfolio trends from digital creative agencies
- Use subtle animations like sparkle effects for AI actions and bouncy animations for sticky notes using Framer Motion.