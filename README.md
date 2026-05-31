# Notora

A personal productivity workspace built with Next.js — tasks, journal, sticky notes, link library, and daily log trackers, with AI assistance powered by Genkit (Google Gemini) and Azure OpenAI.

## Features

- **Tasks** — daily, recurring, weekly, and monthly tasks with priority, XP-based gamification, carry-forward, and a calendar/monthly view.
- **Task Templates & Bundles** — save reusable task definitions and group them into bundles to one-click-add an entire routine (e.g. "Start of month") without polluting each month by default.
- **Journal** — Markdown entries with mood tagging, AI reflection, templates, and discovery.
- **Sticky Notes** — draggable themed notes organised into boards, with AI tools (Polish, Summarize, Bullet-ify, Simplify, custom transforms).
- **Saved Links** — categorised link library with AI-generated summaries and search.
- **Log Trackers** — configurable trackers (calories, water, steps, etc.) with goals and daily activity notes; AI calorie coach included.
- **Multi-user** — two-user local auth (SHA-256 hashed passwords); per-user data isolation via separate Azure blobs.
- **PWA** — installable, with service worker (via `@ducanh2912/next-pwa`).

## Tech Stack

- **Framework:** Next.js (App Router) + React + TypeScript
- **UI:** Tailwind CSS, Radix UI, shadcn-style components, Framer Motion
- **Persistence:** Azure Blob Storage (one JSON blob per user)
- **Auth:** Local credential list seeded into Azure (`users.json`), SHA-256 hashed, session in `localStorage`
- **AI:** Genkit + `@genkit-ai/google-genai` (Gemini) and Azure OpenAI

## Getting Started

```bash
npm install
npm run dev          # starts on http://localhost:9002
npm run typecheck    # tsc --noEmit
npm run lint
npm run build
```

For Genkit flow development:

```bash
npm run genkit:dev
npm run genkit:watch
```

## Environment Variables

Create a `.env` file at the project root:

```
AZURE_STORAGE_CONNECTION_STRING=<your-azure-blob-connection-string>
# plus any keys required by Genkit / Azure OpenAI flows under src/ai/
```

> **Note:** After updating environment variables on Vercel, create a new commit and redeploy to ensure serverless functions pick up the latest values and the build cache is invalidated.

Without `AZURE_STORAGE_CONNECTION_STRING`, the app falls back to the seed users in `src/lib/users.ts` and will not persist data.

## Data Model

User data is stored in the `to-do-notes` container as:

- `users.json` — shared user registry (username, email, SHA-256 password hash, avatar)
- `notora-data-<username>.json` — per-user app data (tasks, templates, bundles, notes, journal, links, log trackers, XP)

Each user has a completely separate blob, so multiple users cannot interfere with each other's data.

## Auth & Passwords

Passwords are stored only as SHA-256 hashes (`src/lib/users.ts` seed and `users.json` in Azure). The originals are not recoverable. Use the in-app **Change Password** flow (`/api/change-password`) or update the `passwordHash` field of `users.json` directly to reset.

## Project Structure

```
src/
  app/             # Next.js routes (tasks, journal, notes, links, logs, login, api/*)
  components/
    notora/        # Feature components
    ui/            # Reusable primitives
  contexts/        # Auth, App data, Showcase
  hooks/           # use-auth, use-app, use-toast, ...
  lib/             # storage (Azure), users, types, utils, azure-openai
  ai/              # Genkit flows
```

Entry point for the home page: `src/app/page.tsx`.
