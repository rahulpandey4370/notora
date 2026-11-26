// Changes the Notora assistant can propose. The agent never writes: it proposes these,
// the app shows them with Confirm/Cancel, and only a confirmed list is applied (by
// src/ai/flows/apply-agent-actions.ts). Pure; checked by `npx tsx src/lib/agent-actions.check.ts`.
import { z } from 'zod';
import type { AppData, StickyNote, Task } from '@/lib/types';
import { linkCategories, moods } from '@/lib/types';
import { getTaskXp } from '@/lib/utils';
import { applyDraft, applyLogEdits, editDayItem, MEAL_SLOTS } from '@/lib/fitness';
import { deleteFrom, editFrom, isRepeating } from '@/lib/tasks';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1);
const g = z.number().min(0).max(5000);
const slot = z.enum(MEAL_SLOTS.map(x => x.id) as [string, ...string[]]);
const priority = z.enum(['Easy', 'Medium', 'Hard']);

export const AgentActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('task.add'), title: z.string().min(1).max(200), priority: priority.optional(), repeat: z.enum(['none', 'daily', 'monthly']).optional(), date: ymd.optional() }),
  z.object({ type: z.literal('task.update'), id, title: z.string().min(1).max(200).optional(), priority: priority.optional(), date: ymd.optional() }),
  z.object({ type: z.literal('task.delete'), id, everywhere: z.boolean().optional() }),
  z.object({ type: z.literal('task.complete'), id, date: ymd, done: z.boolean() }),
  z.object({ type: z.literal('note.add'), content: z.string().min(1).max(5000), title: z.string().max(120).optional(), board: z.string().optional() }),
  z.object({ type: z.literal('note.update'), id, content: z.string().max(5000).optional(), title: z.string().max(120).optional() }),
  z.object({ type: z.literal('note.delete'), id }),
  z.object({ type: z.literal('journal.write'), date: ymd, content: z.string().min(1).max(20000), mood: z.enum(moods).optional(), append: z.boolean().optional() }),
  z.object({ type: z.literal('link.add'), url: z.string().url(), title: z.string().max(300).optional(), summary: z.string().max(2000).optional(), category: z.enum(linkCategories).optional() }),
  z.object({ type: z.literal('link.delete'), id }),
  z.object({ type: z.literal('tracker.log'), tracker: z.string().min(1), date: ymd, value: z.number().positive().max(1_000_000) }),
  z.object({ type: z.literal('food.add'), date: ymd, meals: z.array(z.object({ name: z.string().min(1).max(300), kcal: g, proteinG: g, carbsG: g.optional(), fatG: g.optional(), fiberG: g.optional(), slot: slot.optional() })).min(1).max(20) }),
  z.object({ type: z.literal('food.edit'), date: ymd, id, name: z.string().min(1).max(300).optional(), kcal: g.optional(), proteinG: g.optional(), carbsG: g.optional(), fatG: g.optional(), fiberG: g.optional(), slot: slot.optional() }),
  z.object({ type: z.literal('food.delete'), date: ymd, id }),
  z.object({ type: z.literal('workout.add'), date: ymd, name: z.string().min(1).max(200), minutes: z.number().min(0).max(1440), kcal: g, stepBased: z.boolean().optional() }),
  z.object({ type: z.literal('workout.delete'), date: ymd, id }),
]);
export type AgentAction = z.infer<typeof AgentActionSchema>;
export type ProposedAction = { action: AgentAction; description: string };

type Ctx = { today: string; now: string; newId: () => string };
const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const q = (s: string) => `“${s.length > 60 ? `${s.slice(0, 59)}…` : s}”`;
const findTask = (d: AppData, taskId: string) => d.tasks.find(t => t.id === taskId);
const findNote = (d: AppData, noteId: string) => d.noteBoards.flatMap(b => b.notes).find(n => n.id === noteId);
const findTracker = (d: AppData, name: string) => d.logTrackers.find(t => t.id === name) ?? d.logTrackers.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
const meal = (d: AppData, date: string, mealId: string) => d.fitnessDays?.[date]?.meals.find(m => m.id === mealId);
const workout = (d: AppData, date: string, wId: string) => d.fitnessDays?.[date]?.activities.find(a => a.id === wId);
const localYmd = (iso: string) => { const t = new Date(iso); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

/** What the confirm card says; null when the target doesn't exist (the action is then dropped). */
export function describeAction(a: AgentAction, d: AppData): string | null {
  switch (a.type) {
    case 'task.add': return `Add task ${q(a.title)}${a.repeat === 'daily' ? ', every day' : a.repeat === 'monthly' ? ', every month' : a.date ? ` on ${short(a.date)}` : ' for today'} (${a.priority ?? 'Medium'})`;
    case 'task.update': { const t = findTask(d, a.id); if (!t) return null;
      const bits = [a.title && `rename to ${q(a.title)}`, a.priority && `priority ${a.priority}`, a.date && `move to ${short(a.date)}`].filter(Boolean).join(', ');
      return `Change task ${q(t.title)}: ${bits || 'no change'}${isRepeating(t) ? ' (from today on)' : ''}`; }
    case 'task.delete': { const t = findTask(d, a.id); if (!t) return null;
      return `Delete task ${q(t.title)}${isRepeating(t) && !a.everywhere ? ' from today on (earlier days keep it)' : ''}`; }
    case 'task.complete': { const t = findTask(d, a.id); return t ? `Mark ${q(t.title)} ${a.done ? 'done' : 'not done'} on ${short(a.date)}` : null; }
    case 'note.add': return `Add a note${a.title ? ` ${q(a.title)}` : ''}${a.board ? ` to ${q(a.board)}` : ''}: ${q(a.content)}`;
    case 'note.update': { const n = findNote(d, a.id); return n ? `Edit note ${q(n.title || n.content)}` : null; }
    case 'note.delete': { const n = findNote(d, a.id); return n ? `Delete note ${q(n.title || n.content)}` : null; }
    case 'journal.write': return `${a.append ? 'Add to' : 'Write'} the journal for ${short(a.date)}: ${q(a.content)}`;
    case 'link.add': return `Save link ${q(a.title ?? a.url)}`;
    case 'link.delete': { const l = d.savedLinks.find(x => x.id === a.id); return l ? `Delete link ${q(l.title)}` : null; }
    case 'tracker.log': { const t = findTracker(d, a.tracker); return t ? `Log ${a.value} ${t.unit} in ${t.name} on ${short(a.date)}` : null; }
    case 'food.add': return `Log ${a.meals.map(m => `${m.name} (${Math.round(m.kcal)} kcal)`).join(', ')} on ${short(a.date)}`;
    case 'food.edit': { const m = meal(d, a.date, a.id); if (!m) return null;
      return `Change ${q(m.name)} on ${short(a.date)}${a.kcal != null ? `: ${Math.round(m.kcal)} → ${Math.round(a.kcal)} kcal` : ''}${a.name ? ` (now ${q(a.name)})` : ''}`; }
    case 'food.delete': { const m = meal(d, a.date, a.id); return m ? `Delete ${q(m.name)} (${Math.round(m.kcal)} kcal) on ${short(a.date)}` : null; }
    case 'workout.add': return `Log workout ${q(a.name)}, ${Math.round(a.minutes)} min, ${Math.round(a.kcal)} kcal on ${short(a.date)}`;
    case 'workout.delete': { const w = workout(d, a.date, a.id); return w ? `Delete workout ${q(w.name)} on ${short(a.date)}` : null; }
  }
}

function applyOne(d: AppData, a: AgentAction, ctx: Ctx): AppData {
  const { today, now, newId } = ctx;
  switch (a.type) {
    case 'task.add': {
      const repeat = a.repeat ?? 'none';
      const t: Task = {
        id: newId(), title: a.title.trim(), priority: a.priority ?? 'Medium', completions: [], createdAt: now, carryForwardCount: 0,
        type: repeat === 'daily' ? 'recurring' : repeat === 'monthly' ? 'monthly' : 'single',
        ...(repeat === 'none' ? { date: a.date ?? today } : { ongoing: true }),
        ...(repeat === 'monthly' ? { month: (a.date ?? today).slice(0, 7) } : {}),
        ...(repeat === 'daily' && a.date && a.date > today ? { startsOn: a.date } : {}),
      };
      return { ...d, tasks: [...d.tasks, t] };
    }
    case 'task.update': {
      const t = findTask(d, a.id)!;
      const change = { ...(a.title ? { title: a.title.trim() } : {}), ...(a.priority ? { priority: a.priority } : {}) };
      if (isRepeating(t)) return { ...d, tasks: d.tasks.flatMap(x => (x.id === t.id ? editFrom(t, change, today, newId) : [x])) };
      return { ...d, tasks: d.tasks.map(x => (x.id === t.id ? { ...x, ...change, ...(a.date && x.type === 'single' ? { date: a.date } : {}) } : x)) };
    }
    case 'task.delete': {
      const t = findTask(d, a.id)!;
      if (isRepeating(t) && !a.everywhere) {
        const { task, removed } = deleteFrom(t, today);
        return { ...d, tasks: task ? d.tasks.map(x => (x.id === t.id ? task : x)) : d.tasks.filter(x => x.id !== t.id), userStats: { xp: d.userStats.xp - removed * getTaskXp(t) } };
      }
      return { ...d, tasks: d.tasks.filter(x => x.id !== t.id), userStats: { xp: d.userStats.xp - (t.completions ?? []).length * getTaskXp(t) } };
    }
    case 'task.complete': {
      const t = findTask(d, a.id)!;
      const key = t.type === 'monthly' ? `${a.date.slice(0, 7)}-01` : a.date;
      const has = (t.completions ?? []).includes(key);
      if (has === a.done) return d;
      const completions = a.done ? [...(t.completions ?? []), key] : (t.completions ?? []).filter(c => c !== key);
      return { ...d, tasks: d.tasks.map(x => (x.id === t.id ? { ...x, completions } : x)), userStats: { xp: d.userStats.xp + (a.done ? 1 : -1) * getTaskXp(t) } };
    }
    case 'note.add': {
      const board = d.noteBoards.find(b => a.board && b.title.toLowerCase() === a.board.toLowerCase()) ?? d.noteBoards[0];
      if (!board) throw new Error('There are no note boards yet.');
      const lowest = Math.max(-280, ...board.notes.map(n => n.position?.y ?? 0));
      const note: StickyNote = { id: newId(), title: a.title ?? '', content: a.content, theme: 'yellow', position: { x: 24, y: lowest + 280 } };
      return { ...d, noteBoards: d.noteBoards.map(b => (b.id === board.id ? { ...b, notes: [note, ...b.notes] } : b)) };
    }
    case 'note.update':
      return { ...d, noteBoards: d.noteBoards.map(b => ({ ...b, notes: b.notes.map(n => {
        if (n.id !== a.id) return n;
        const next = { ...n, ...(a.content != null ? { content: a.content } : {}), ...(a.title != null ? { title: a.title } : {}) };
        // Keep undo working: the old version goes into the note's history.
        return n.history ? { ...next, history: { past: [...n.history.past, n.history.present], present: { title: next.title ?? '', content: next.content }, future: [] } } : next;
      }) })) };
    case 'note.delete':
      return { ...d, noteBoards: d.noteBoards.map(b => ({ ...b, notes: b.notes.filter(n => n.id !== a.id) })) };
    case 'journal.write': {
      const existing = d.journalEntries.find(j => localYmd(j.date) === a.date);
      if (existing) {
        return { ...d, journalEntries: d.journalEntries.map(j => (j.id !== existing.id ? j
          : { ...j, content: a.append ? `${j.content.trimEnd()}\n\n${a.content}` : a.content, ...(a.mood ? { mood: a.mood } : {}) })) };
      }
      return { ...d, journalEntries: [...d.journalEntries, { id: newId(), date: new Date(`${a.date}T12:00:00`).toISOString(), content: a.content, ...(a.mood ? { mood: a.mood } : {}) }] };
    }
    case 'link.add':
      return { ...d, savedLinks: [{ id: newId(), url: a.url, title: a.title ?? a.url, summary: a.summary ?? '', category: a.category ?? 'Other', dateAdded: now }, ...d.savedLinks] };
    case 'link.delete':
      return { ...d, savedLinks: d.savedLinks.filter(l => l.id !== a.id) };
    case 'tracker.log': {
      const t = findTracker(d, a.tracker)!;
      return applyDraft(d, { date: a.date, meals: [], activities: [], values: [{ trackerId: t.id, value: a.value }] }, newId);
    }
    case 'food.add':
      return applyDraft(d, { date: a.date, meals: a.meals.map(m => ({ ...m, slot: m.slot as never })), activities: [], values: [] }, newId);
    case 'food.edit': {
      const { type: _t, date, id: mealId, ...patch } = a;
      return applyLogEdits(d, date, [{ id: mealId, patch: patch as never }], newId);
    }
    case 'food.delete':
      return applyLogEdits(d, a.date, [{ id: a.id, delete: true }], newId);
    case 'workout.add':
      return applyDraft(d, { date: a.date, meals: [], activities: [{ name: a.name, minutes: a.minutes, kcal: a.kcal, stepBased: !!a.stepBased }], values: [] }, newId);
    case 'workout.delete':
      return editDayItem(d, a.date, 'activity', a.id, null, newId);
  }
}

/** Apply a confirmed list in order. Actions whose target no longer exists are skipped and reported. */
export function applyActions(data: AppData, actions: AgentAction[], ctx: Ctx): { data: AppData; applied: string[]; skipped: string[] } {
  let d = data;
  const applied: string[] = [], skipped: string[] = [];
  for (const a of actions) {
    const text = describeAction(a, d);
    if (!text) { skipped.push(`${a.type}: not found any more`); continue; }
    try { d = applyOne(d, a, ctx); applied.push(text); }
    catch (e: any) { skipped.push(`${text}: ${e?.message ?? 'failed'}`); }
  }
  return { data: d, applied, skipped };
}
