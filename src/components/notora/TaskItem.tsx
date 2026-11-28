'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronsRight, Repeat, Pencil, Ban } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import type { AppData, Task } from "@/lib/types";
import { ToastAction } from "../ui/toast";
import type { useToast } from "@/hooks/use-toast";
import { getTaskXp } from "@/lib/utils";
import { skipOn, skippedOn, taskDay, type DayStatus } from "@/lib/task-status";
import { Badge } from "../ui/badge";
import { motion } from 'framer-motion';
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  isCompleted: boolean;
  onCarryForward?: () => void;
  /** Repeating tasks: the bin offers "delete from today" (keeps past days) before "delete everywhere". */
  onDeleteFromToday?: () => void;
  /** Repeating tasks: edits apply from today on; earlier days keep the task as it was. */
  onEditFromToday?: (change: { title: string; priority: Task['priority'] }) => void;
  /** Single tasks: edit title, priority and date in place. */
  onEdit?: (change: { title: string; priority: Task['priority']; date?: string }) => void;
  isPastDue?: boolean;
  /** Past one-off tasks: mark "won't do" (it stays on its day, no longer open or overdue), or undo it. */
  onWontDo?: () => void;
  /** The task's status on this row's day (lib/task-status); 'wontDo' shows the tag. */
  status?: DayStatus;
  className?: string;
}

/** Crossing 100 XP earns the "reward yourself" toast (Tasks page and Dashboard). */
export const crossesReward = (before: number, after: number) => before < 100 && after >= 100;

/** Single-task edit: a moved date takes its tick along; a priority change re-prices the ticks already earned. */
export function editSingleTask(task: Task, edit: { title: string; priority: Task['priority']; date?: string }): { task: Task; xpDelta: number } {
  const completions = edit.date && task.date ? (task.completions || []).map(c => (c === task.date ? edit.date! : c)) : task.completions;
  const next = { ...task, ...edit, completions };
  // Moved to another day: a "won't do" on the old day doesn't follow it.
  if (edit.date && task.date && edit.date !== task.date) delete next.skipped;
  return { task: next, xpDelta: (completions || []).length * (getTaskXp(next) - getTaskXp(task)) };
}

/**
 * Mark a one-off task "won't do" on its own day, or undo it (lib/task-status). Marking shows a toast with Undo,
 * because on the Dashboard the task leaves the list; Undo reads `latest`, so later edits are kept.
 */
export function wontDoWithUndo(id: string, latest: { current: AppData }, onDataChange: (d: AppData) => void, toast: ReturnType<typeof useToast>['toast']) {
  /** Flip the mark, or with `only: 'clear'` just remove it (Undo must never re-mark a task the user has since unmarked). */
  const change = (only?: 'clear') => {
    const cur = latest.current;
    const task = cur.tasks.find(t => t.id === id);
    if (!task) return null;
    const day = taskDay(task.date);
    if (only === 'clear' && !skippedOn(task, day)) return null;
    const next = skipOn(task, day);
    if (next !== task) onDataChange({ ...cur, tasks: cur.tasks.map(t => (t.id === id ? next : t)) });
    return skippedOn(next, day) ? next : null;
  };
  const marked = change();
  if (marked) toast({ title: "Marked won't do", description: `"${marked.title}" stays on its day and is no longer overdue.`, action: <ToastAction altText="Undo won't do" onClick={() => change('clear')}>Undo</ToastAction> });
}

/**
 * Delete at once; the toast's Undo puts the task back at its old place with its ticks and XP.
 * Undo reads `latest` (the data as it is then), so edits made after the delete are kept.
 */
export function deleteWithUndo(id: string, latest: { current: AppData }, onDataChange: (d: AppData) => void, toast: ReturnType<typeof useToast>['toast']) {
  const data = latest.current;
  const index = data.tasks.findIndex(t => t.id === id);
  if (index < 0) return;
  const task = data.tasks[index];
  const xp = (task.completions || []).length * getTaskXp(task);
  onDataChange({ ...data, tasks: data.tasks.filter(t => t.id !== id), userStats: { ...data.userStats, xp: data.userStats.xp - xp } });
  const restore = () => {
    const cur = latest.current;
    if (cur.tasks.some(t => t.id === id)) return;
    const tasks = [...cur.tasks];
    tasks.splice(Math.min(index, tasks.length), 0, task);
    onDataChange({ ...cur, tasks, userStats: { ...cur.userStats, xp: cur.userStats.xp + xp } });
  };
  toast({ title: 'Task deleted', description: task.title, action: <ToastAction altText="Undo delete" onClick={restore}>Undo</ToastAction> });
}

const priorityStyles = {
    Easy: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300",
    Medium: "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    Hard: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
}

export default function TaskItem({ task, onToggle, onDelete, isCompleted, onCarryForward, onDeleteFromToday, onEditFromToday, onEdit, isPastDue = false, onWontDo, status, className }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: task.title, priority: task.priority, date: task.date });
  const save = onEditFromToday ?? onEdit;
  const repeating = !!onDeleteFromToday;
  const period = task.type === 'monthly' ? 'month' : 'day';
  const uniqueId = `task-${task.id}-${task.date || ''}`;
  const taskXp = getTaskXp(task);
  const { resolvedTheme } = useTheme();
  
  const isOverdue = isPastDue && !isCompleted;
  const wontDo = status === 'wontDo';
  const canCarryForward = !!onCarryForward;

  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      data-status={status}
      className={cn(
        // Wraps on a narrow screen: the action buttons drop to a second line instead of squeezing the title away.
        "flex flex-wrap items-center gap-x-4 gap-y-1 p-3 nb-border rounded-lg bg-card hover:nb-shadow transition-shadow duration-200",
        isOverdue && "bg-muted/50 opacity-70",
        wontDo && "bg-muted/40",
        className
      )}
    >
      <div
        className="flex min-w-[9rem] items-center gap-4 flex-1 rounded-md"
      >
        <Checkbox
          id={uniqueId}
          checked={isCompleted}
          onCheckedChange={onToggle}
          aria-labelledby={`${uniqueId}-label`}
          className="w-5 h-5 nb-border rounded-sm data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:border-slate-700"
        />
        <label
          id={`${uniqueId}-label`}
          htmlFor={uniqueId}
          className="flex-1 text-sm font-medium cursor-pointer transition-all"
        >
          <span className={cn(
            isCompleted && 'line-through bg-primary/70 text-muted-foreground px-2 rounded-sm',
            (isOverdue || wontDo) && 'text-muted-foreground'
          )}>
            {task.title}
          </span>
          {wontDo && <span className="ml-2 inline-block rounded-full border border-border px-2 py-0.5 align-middle text-[11px] font-normal text-muted-foreground">Won&apos;t do</span>}
          {repeating && <Repeat className="ml-1.5 inline h-3 w-3 text-muted-foreground" aria-label={task.type === 'monthly' ? 'Repeats monthly' : 'Repeats daily'} />}
        </label>
      </div>
      
      <Badge variant="outline" className={`font-mono text-xs ${priorityStyles[task.priority]}`}>{taskXp} XP</Badge>

      <div className="ml-auto flex shrink-0 items-center gap-2">
      {canCarryForward && (
        <Button variant="ghost" size="icon" onClick={onCarryForward} className="h-11 w-11 md:h-8 md:w-8 text-blue-500 hover:text-blue-500 rounded-full" title="Carry forward to next day" aria-label={`Carry ${task.title} forward to next day`}>
            <ChevronsRight className="h-4 w-4" />
        </Button>
      )}

      {onWontDo && (
        <Button variant="ghost" size="icon" onClick={onWontDo} aria-pressed={wontDo} title={wontDo ? "Undo won't do" : "Won't do: keep it on its day, stop showing it as overdue"}
          aria-label={wontDo ? `Undo won't do for ${task.title}` : `Won't do ${task.title}`}
          className={cn("h-11 w-11 md:h-8 md:w-8 rounded-full text-black/60 hover:bg-primary/10 dark:text-slate-400", wontDo && "bg-primary/15 text-foreground")}>
          <Ban className="h-4 w-4" />
        </Button>
      )}

      {save && (
        <>
          <Button variant="ghost" size="icon" aria-label={`Edit ${task.title}`} title={onEditFromToday ? 'Edit from today on' : 'Edit task'}
            onClick={() => { setDraft({ title: task.title, priority: task.priority, date: task.date }); setEditing(true); }}
            className="h-11 w-11 md:h-8 md:w-8 text-black/60 hover:bg-primary/10 rounded-full dark:text-slate-400">
            <Pencil className="h-4 w-4" />
          </Button>
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{onEditFromToday ? 'Edit repeating task' : 'Edit task'}</DialogTitle>
                <DialogDescription>{onEditFromToday ? `Changes apply from ${task.type === 'monthly' ? 'this month' : 'today'} on. Earlier ${period}s keep the task as it was.` : 'Change the title, priority or date.'}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} aria-label="Task title" autoFocus />
                <Select value={draft.priority} onValueChange={v => setDraft(d => ({ ...d, priority: v as Task['priority'] }))}>
                  <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
                {!onEditFromToday && task.type === 'single' && (
                  <Input type="date" value={draft.date ?? ''} onChange={e => setDraft(d => ({ ...d, date: e.target.value || d.date }))} aria-label="Date" />
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button disabled={!draft.title.trim() || (draft.title.trim() === task.title && draft.priority === task.priority && draft.date === task.date)}
                  onClick={() => { save({ title: draft.title.trim(), priority: draft.priority, ...(onEditFromToday ? {} : { date: draft.date }) }); setEditing(false); }}>{onEditFromToday ? `Save from ${task.type === 'monthly' ? 'this month' : 'today'}` : 'Save'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {onDeleteFromToday ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Remove ${task.title}`} className="h-11 w-11 md:h-8 md:w-8 text-black/60 hover:text-destructive hover:bg-destructive/10 rounded-full dark:text-slate-400 dark:hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove “{task.title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                “From {task.type === 'monthly' ? 'this month' : 'today'}” keeps it, and your ticks, on earlier {period}s. “Everywhere” removes it from every {period}, including its XP.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>Delete everywhere</AlertDialogAction>
              <AlertDialogAction onClick={onDeleteFromToday}>Delete from {task.type === 'monthly' ? 'this month' : 'today'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete ${task.title}`} className="h-11 w-11 md:h-8 md:w-8 text-black/60 hover:text-destructive hover:bg-destructive/10 rounded-full dark:text-slate-400 dark:hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      </div>
    </motion.div>
  );
}
