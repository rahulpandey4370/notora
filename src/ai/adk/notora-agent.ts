import { FunctionTool, InMemoryRunner, LlmAgent, createEvent, isFinalResponse } from '@google/adk';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAiFeature } from '@/lib/usage';
import { requireUser } from '@/lib/session';
import { getAppData, saveAppData } from '@/lib/storage';
import type { AppData, Task } from '@/lib/types';
import { adkModelFor } from './model';

/*
 * Notora's chat assistant on Google ADK (same pattern as FinWise's
 * src/ai/adk/finance-agent.ts): read tools over the user's workspace plus two
 * small write tools. Writes go through the same versioned save as the app, so
 * they can't overwrite edits made on another device.
 */

const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const ymdOf = (v?: string) => (!v ? '' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(v)));
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD');
const clip = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ADK types its zod params against its own bundled zod; ours is the same API at
// runtime, so bridge the types here once (as FinWise does).
function tool<S extends z.ZodTypeAny = z.ZodObject<{}>>(opts: {
  name: string; description: string; parameters?: S; execute: (input: z.infer<S>) => Promise<unknown>;
}): FunctionTool<any> {
  return new FunctionTool({ ...opts, parameters: opts.parameters as any, execute: opts.execute as any });
}

async function load(): Promise<AppData> {
  const stored = await getAppData();
  if (!stored) throw new Error('No workspace yet.');
  return stored.data;
}

/** Read-modify-save with one retry if another device saved in between. */
async function update(change: (d: AppData) => AppData, onChanged: () => void): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const stored = await getAppData();
    if (!stored) throw new Error('No workspace yet.');
    const result = await saveAppData(change(stored.data), stored.version);
    if (result.ok) { onChanged(); return; }
  }
  throw new Error('The workspace kept changing on another device; try again.');
}

function buildTools(onChanged: () => void) {
  return [
    tool({
      name: 'list_tasks',
      description: "Tasks for one day (default today): title, priority, whether done that day. Includes that month's recurring tasks.",
      parameters: z.object({ date: ymd.optional() }),
      execute: async ({ date }) => {
        const day = date ?? todayYmd();
        const tasks = (await load()).tasks.filter(t =>
          t.type === 'single' ? ymdOf(t.date) === day
            : t.type === 'recurring' ? ymdOf(t.createdAt).slice(0, 7) === day.slice(0, 7) && ymdOf(t.createdAt) <= day
              : t.type === 'monthly' ? t.month === day.slice(0, 7) : false);
        return { date: day, tasks: tasks.map(t => ({ title: t.title, priority: t.priority, type: t.type, done: (t.completions ?? []).includes(day) })) };
      },
    }),
    tool({
      name: 'search_workspace',
      description: 'Full-text search across sticky notes, journal entries, saved links and task titles. Use for any "what did I write about X".',
      parameters: z.object({ query: z.string().min(2) }),
      execute: async ({ query }) => {
        const q = query.toLowerCase();
        const d = await load();
        const has = (...p: (string | undefined)[]) => p.some(x => x?.toLowerCase().includes(q));
        return {
          notes: d.noteBoards.flatMap(b => b.notes.filter(n => has(n.title, n.content)).map(n => ({ board: b.title, title: n.title, content: clip(n.content) }))).slice(0, 15),
          journal: d.journalEntries.filter(j => has(j.content, ...(j.tags ?? []))).map(j => ({ date: ymdOf(j.date), mood: j.mood, content: clip(j.content) })).slice(0, 10),
          links: d.savedLinks.filter(l => has(l.title, l.summary, l.url)).map(l => ({ title: l.title, url: l.url, summary: clip(l.summary, 200) })).slice(0, 10),
          tasks: d.tasks.filter(t => has(t.title)).map(t => ({ title: t.title, date: t.date, type: t.type })).slice(0, 15),
        };
      },
    }),
    tool({
      name: 'recent_journal',
      description: 'Journal entries from the last N days (default 7), newest first.',
      parameters: z.object({ days: z.number().int().min(1).max(60).optional() }),
      execute: async ({ days }) => {
        const since = new Date(Date.now() - (days ?? 7) * 86400_000).toISOString().slice(0, 10);
        return (await load()).journalEntries.filter(j => ymdOf(j.date) >= since)
          .sort((a, b) => b.date.localeCompare(a.date)).map(j => ({ date: ymdOf(j.date), mood: j.mood, content: clip(j.content, 800) }));
      },
    }),
    tool({
      name: 'get_trackers',
      description: 'Log trackers (steps, sleep, resting heart rate from Fitbit, calories, water…) with goal and the last N days of values (default 14).',
      parameters: z.object({ days: z.number().int().min(1).max(90).optional() }),
      execute: async ({ days }) => {
        const since = new Date(Date.now() - (days ?? 14) * 86400_000).toISOString().slice(0, 10);
        return (await load()).logTrackers.map(t => ({
          name: t.name, unit: t.unit, goal: t.goal, source: t.healthMetric ? 'fitbit' : 'manual',
          logs: t.logs.filter(l => l.date >= since).map(l => ({ date: l.date, value: l.value })),
        }));
      },
    }),
    tool({
      name: 'add_task',
      description: 'Add a one-off task. Only when the user asks to add/remind/plan something.',
      parameters: z.object({ title: z.string().min(1).max(200), date: ymd.optional(), priority: z.enum(['Easy', 'Medium', 'Hard']).optional() }),
      execute: async ({ title, date, priority }) => {
        const task: Task = { id: uuidv4(), title, priority: priority ?? 'Medium', type: 'single', completions: [], createdAt: new Date().toISOString(), date: date ?? todayYmd() };
        await update(d => ({ ...d, tasks: [...d.tasks, task] }), onChanged);
        return { added: { title: task.title, date: task.date, priority: task.priority } };
      },
    }),
    tool({
      name: 'add_note',
      description: 'Save a sticky note on a board (default: the first board). Only when the user asks to save/note/jot something.',
      parameters: z.object({ content: z.string().min(1).max(5000), title: z.string().max(120).optional(), board: z.string().optional().describe('Board title') }),
      execute: async ({ content, title, board }) => {
        let boardTitle = '';
        await update(d => {
          const target = d.noteBoards.find(b => board && b.title.toLowerCase() === board.toLowerCase()) ?? d.noteBoards[0];
          if (!target) throw new Error('There are no note boards yet.');
          boardTitle = target.title;
          const lowest = Math.max(-280, ...target.notes.map(n => n.position?.y ?? 0));
          const note = { id: uuidv4(), title: title ?? '', content, theme: 'yellow' as const, position: { x: 24, y: lowest + 280 } };
          return { ...d, noteBoards: d.noteBoards.map(b => (b.id === target.id ? { ...b, notes: [note, ...b.notes] } : b)) };
        }, onChanged);
        return { saved: true, board: boardTitle };
      },
    }),
  ];
}

const INSTRUCTION = `You are Notora's assistant inside the user's personal productivity app (tasks, journal, sticky notes, saved links, log trackers incl. Fitbit steps/sleep/resting heart rate).
- Use the tools to look things up instead of guessing; never invent entries.
- Only call add_task / add_note when the user clearly asks for it, then confirm in one short line.
- Be concise and warm. Use short markdown lists when listing things.`;

export type AgentTurn = { role: 'user' | 'model'; content: string };

/**
 * One chat turn. Earlier turns are replayed into a throwaway session
 * (FinWise's runAgentTurn pattern). `changed` tells the client to reload.
 */
export async function runNotoraAgent(input: { query: string; history: AgentTurn[]; pageContext?: string; modelKey: string }): Promise<{ response: string; changed: boolean }> {
  // Gemini runs through ADK's own client, not callToolChatLLM, so it skips that
  // guard: check the session here for every provider.
  await requireUser();
  let changed = false;
  const agent = new LlmAgent({
    name: 'notora_assistant',
    description: "Answers questions about the user's Notora workspace and adds tasks or notes when asked.",
    model: adkModelFor(input.modelKey),
    instruction: [INSTRUCTION, `Today is ${todayYmd()} (${TZ}).`,
      input.pageContext ? `The page the user is looking at (JSON, may be truncated):\n${clip(input.pageContext, 6000)}` : ''].filter(Boolean).join('\n\n'),
    tools: buildTools(() => { changed = true; }),
    generateContentConfig: { temperature: 0.2 },
  });

  const response = await withAiFeature('chat', async () => {
    const runner = new InMemoryRunner({ agent, appName: 'notora' });
    const session = await runner.sessionService.createSession({ appName: 'notora', userId: 'me' });
    // Replay from the first user turn: the chat window opens with a canned
    // greeting, and some providers reject a conversation that starts with the model.
    const recent = input.history.slice(-8);
    const firstUser = recent.findIndex(t => t.role === 'user');
    for (const turn of firstUser === -1 ? [] : recent.slice(firstUser)) {
      await runner.sessionService.appendEvent({
        session,
        event: createEvent({
          invocationId: 'history',
          author: turn.role === 'user' ? 'user' : agent.name,
          content: { role: turn.role === 'user' ? 'user' : 'model', parts: [{ text: turn.content }] },
        }),
      });
    }
    let finalText = '';
    let error = '';
    for await (const event of runner.runAsync({
      userId: 'me',
      sessionId: session.id,
      newMessage: { role: 'user', parts: [{ text: input.query }] },
      runConfig: { maxLlmCalls: 8 },
    })) {
      if (event.errorMessage) error = event.errorMessage;
      if (isFinalResponse(event)) {
        const text = event.content?.parts?.map(p => p.text ?? '').join('') ?? '';
        if (text.trim()) finalText = text;
      }
    }
    if (!finalText && error) throw new Error(error);
    return finalText;
  });
  return { response: response || "Sorry, I couldn't come up with an answer. Try rephrasing.", changed };
}
