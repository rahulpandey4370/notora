import { FunctionTool, InMemoryRunner, LlmAgent, createEvent, isFinalResponse } from '@google/adk';
import { searchWeb } from '@/lib/web-search';
import { monthlyShowsIn, recurringShowsOn } from '@/lib/tasks';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAiFeature } from '@/lib/usage';
import { requireUser } from '@/lib/session';
import { getAppData } from '@/lib/storage';
import type { AppData } from '@/lib/types';
import { AgentActionSchema, describeAction, type ProposedAction } from '@/lib/agent-actions';
import { dayMacros, findTracker } from '@/lib/fitness';
import { adkModelFor } from './model';

/*
 * Notora's assistant on Google ADK (FinWise's finance-agent pattern): read tools over
 * the whole workspace, and propose_* tools for every change. It never writes: proposals
 * come back to the chat as a Confirm/Cancel card, and only a confirmed list is applied
 * (src/ai/flows/apply-agent-actions.ts, rules in src/lib/agent-actions.ts).
 */

const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
export const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
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

const PROPOSE: Record<string, string> = {
  'task.add': 'Propose adding a task. repeat: none (one-off on date, default today), daily or monthly.',
  'task.update': 'Propose renaming / re-prioritising / moving a task (id from list_tasks or search). Repeating tasks change from today on.',
  'task.delete': 'Propose deleting a task. Repeating tasks are removed from today on unless everywhere is true.',
  'task.complete': 'Propose ticking a task done (or not done) for a date.',
  'note.add': 'Propose adding a sticky note (optionally to a board by title).',
  'note.update': 'Propose editing a note (id from list_notes or search).',
  'note.delete': 'Propose deleting a note.',
  'journal.write': "Propose writing (or appending to) the journal entry for a date.",
  'link.add': 'Propose saving a link.',
  'link.delete': 'Propose deleting a saved link (id from list_links or search).',
  'tracker.log': 'Propose logging a value in a tracker (name or id, e.g. Weight, Steps) for a date.',
  'food.add': 'Propose logging food for a date: one entry per item with generous kcal, protein, carbs, fat, fibre and its meal slot.',
  'food.edit': 'Propose changing a logged meal (id from get_food_log); give only the fields that change, scaling all numbers for a new portion.',
  'food.delete': 'Propose deleting a logged meal (id from get_food_log).',
  'workout.add': 'Propose logging a workout for a date (active kcal; stepBased for walks, runs, hikes).',
  'workout.delete': 'Propose deleting a logged workout (id from get_food_log).',
};

/** One propose_* tool per action type; each only records the change for the user to confirm. */
function proposeTools(pending: ProposedAction[]) {
  return AgentActionSchema.options.map(option => {
    const type = option.shape.type.value as string;
    return tool({
      name: `propose_${type.replace('.', '_')}`,
      description: `${PROPOSE[type]} Nothing changes until the user taps Confirm.`,
      parameters: (option as z.AnyZodObject).omit({ type: true }) as unknown as z.ZodTypeAny,
      execute: async (input: Record<string, unknown>) => {
        const parsed = AgentActionSchema.safeParse({ ...input, type });
        if (!parsed.success) return { error: `Invalid: ${parsed.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ')}` };
        const description = describeAction(parsed.data, await load());
        if (!description) return { error: 'Not found. Look the item up with a read tool and use its exact id.' };
        if (pending.length >= 20) return { error: 'Too many changes in one go; ask the user to confirm these first.' };
        pending.push({ action: parsed.data, description });
        return { proposed: description, note: 'Waiting for the user to confirm.' };
      },
    });
  });
}

function buildTools(pending: ProposedAction[], webSearch: boolean) {
  return [
    ...(webSearch ? [tool({
      name: 'web_search',
      description: 'Search the web for facts outside the workspace: news, prices, nutrition, places, how-tos. Returns short results.',
      parameters: z.object({ query: z.string().min(2) }),
      execute: async ({ query }) => (await searchWeb(query)) ?? { error: 'Web search is unavailable right now.' },
    })] : []),
    tool({
      name: 'list_tasks',
      description: "Tasks for one day (default today): title, priority, whether done that day. Includes recurring and monthly tasks.",
      parameters: z.object({ date: ymd.optional() }),
      execute: async ({ date }) => {
        const day = date ?? todayYmd();
        const tasks = (await load()).tasks.filter(t =>
          t.type === 'single' ? ymdOf(t.date) === day
            : t.type === 'recurring' ? recurringShowsOn(t, day, ymdOf(t.createdAt))
              : t.type === 'monthly' ? monthlyShowsIn(t, day.slice(0, 7)) : false);
        return { date: day, tasks: tasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, type: t.type, repeating: !!t.ongoing && !t.endsOn,
          done: (t.completions ?? []).includes(t.type === 'monthly' ? `${day.slice(0, 7)}-01` : day) })) };
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
          notes: d.noteBoards.flatMap(b => b.notes.filter(n => has(n.title, n.content)).map(n => ({ id: n.id, board: b.title, title: n.title, content: clip(n.content) }))).slice(0, 15),
          journal: d.journalEntries.filter(j => has(j.content, ...(j.tags ?? []))).map(j => ({ date: ymdOf(j.date), mood: j.mood, content: clip(j.content) })).slice(0, 10),
          links: d.savedLinks.filter(l => has(l.title, l.summary, l.url)).map(l => ({ id: l.id, title: l.title, url: l.url, summary: clip(l.summary, 200) })).slice(0, 10),
          tasks: d.tasks.filter(t => has(t.title)).map(t => ({ id: t.id, title: t.title, date: t.date, type: t.type, repeating: !!t.ongoing && !t.endsOn })).slice(0, 15),
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
          id: t.id, name: t.name, unit: t.unit, goal: t.goal, source: t.healthMetric ? 'fitbit' : 'manual',
          logs: t.logs.filter(l => l.date >= since).map(l => ({ date: l.date, value: l.value })),
        }));
      },
    }),
    tool({
      name: 'get_food_log',
      description: "One day's food and workouts (default today) with ids, macros, meal slot, the day's totals and calorie target. Use before editing or deleting a meal or workout.",
      parameters: z.object({ date: ymd.optional() }),
      execute: async ({ date }) => {
        const d = await load();
        const day = date ?? todayYmd();
        const fd = d.fitnessDays?.[day];
        return {
          date: day, totals: dayMacros(d, day), kcalTarget: findTracker(d, 'intake')?.goal,
          meals: (fd?.meals ?? []).map(m => ({ id: m.id, name: m.name, slot: m.slot ?? 'other', kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG ?? 0, fatG: m.fatG ?? 0, fiberG: m.fiberG ?? 0 })),
          workouts: (fd?.activities ?? []).map(a => ({ id: a.id, name: a.name, minutes: a.minutes, kcal: a.kcal })),
          fitbitWorkouts: (d.fitbitWorkouts?.[day] ?? []).map(w => ({ name: w.name, minutes: w.minutes, kcal: w.kcal, note: 'from Fitbit, read-only' })),
        };
      },
    }),
    tool({
      name: 'list_notes',
      description: 'Sticky notes with ids, newest first (optionally one board by title).',
      parameters: z.object({ board: z.string().optional() }),
      execute: async ({ board }) => (await load()).noteBoards
        .filter(b => !board || b.title.toLowerCase() === board.toLowerCase())
        .map(b => ({ board: b.title, notes: b.notes.slice(0, 30).map(n => ({ id: n.id, title: n.title, content: clip(n.content) })) })),
    }),
    tool({
      name: 'list_links',
      description: 'Saved links with ids, newest first.',
      parameters: z.object({}),
      execute: async () => [...(await load()).savedLinks].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 30)
        .map(l => ({ id: l.id, title: l.title, url: l.url, category: l.category })),
    }),
    ...proposeTools(pending),
  ];
}

const INSTRUCTION = `You are Notora's assistant: the one place to look up and change anything in the user's app (tasks, sticky notes, journal, saved links, trackers incl. Fitbit data, food log with meals and macros, workouts).
- Look things up with the read tools instead of guessing; never invent entries or ids.
- You can NOT change anything yourself. To add, edit, tick, log or delete, first find the exact item (and its id) with a read tool, then call the matching propose_* tool once per change. The user sees the proposals as a card and confirms them with a Confirm button.
- After proposing, reply with a short list of exactly what will change and ask them to tap Confirm. Never say a change was made or saved.
- Only propose what the user asked for. If a request is ambiguous (which task? which day?), ask instead of guessing.
- Food: estimate generously and never under-count (cooking oil/ghee, sugar, sides, full Indian portions, restaurant food about 30% more); kcal must be at least protein×4 + carbs×4 + fat×9.
- Be concise and warm. Use short markdown lists when listing things.`;

export type AgentTurn = { role: 'user' | 'model'; content: string };

/**
 * One chat turn. Earlier turns are replayed into a throwaway session
 * (FinWise's runAgentTurn pattern). `pending` = the changes it proposed, for the user to confirm.
 */
export async function runNotoraAgent(input: { query: string; history: AgentTurn[]; pageContext?: string; modelKey: string; webSearch?: boolean }): Promise<{ response: string; pending: ProposedAction[] }> {
  // Gemini runs through ADK's own client, not callToolChatLLM, so it skips that
  // guard: check the session here for every provider.
  await requireUser();
  const pending: ProposedAction[] = [];
  const agent = new LlmAgent({
    name: 'notora_assistant',
    description: "Answers questions about the user's Notora workspace and proposes changes for the user to confirm.",
    model: adkModelFor(input.modelKey),
    instruction: [INSTRUCTION, `Today is ${todayYmd()} (${TZ}).`,
      input.webSearch
        ? 'Web search is ON: use web_search for anything about the outside world or that may have changed, and name the sites you used.'
        : 'Web search is OFF: answer outside questions from your own knowledge and say it may be out of date.',
      input.pageContext ? `The page the user is looking at (JSON, may be truncated):\n${clip(input.pageContext, 6000)}` : ''].filter(Boolean).join('\n\n'),
    tools: buildTools(pending, !!input.webSearch),
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
      runConfig: { maxLlmCalls: 14 },
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
  return { response: response || (pending.length ? 'Here’s what I’d change. Tap Confirm to apply it.' : "Sorry, I couldn't come up with an answer. Try rephrasing."), pending };
}
