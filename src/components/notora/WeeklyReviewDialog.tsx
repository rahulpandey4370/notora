'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { generateWeeklyReview, type WeeklyReviewOutput } from '@/ai/flows/weekly-review';
import type { AppData } from '@/lib/types';
import { CalendarRange, Cpu, TrendingUp, AlertTriangle, Link2, Target } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks, eachDayOfInterval, parseISO, isWithinInterval } from 'date-fns';
import { useModelStore } from '@/hooks/use-model-store';

interface WeeklyReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AppData | null;
}

const XP_BY_PRIORITY: Record<string, number> = { Easy: 5, Medium: 10, Hard: 15 };

export default function WeeklyReviewDialog({ open, onOpenChange, data }: WeeklyReviewDialogProps) {
  const [review, setReview] = useState<WeeklyReviewOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedModel } = useModelStore();

  const weekBounds = useMemo(() => {
    const now = new Date();
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
      prevStart: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
      prevEnd: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
    };
  }, []);

  useEffect(() => {
    if (!open || !data) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      setReview(null);

      const { start, end, prevStart, prevEnd } = weekBounds;
      const weekDays = eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
      const inWeek = (ymd: string) => weekDays.includes(ymd);

      // --- Tasks completed this week ---
      const taskStats = (data.tasks || [])
        .map(t => ({
          title: t.title,
          priority: t.priority,
          type: t.type,
          completedThisWeek: (t.completions || []).filter(inWeek).length,
        }))
        .filter(t => t.completedThisWeek > 0);

      const totalCompletions = taskStats.reduce((s, t) => s + t.completedThisWeek, 0);
      const xpEarned = taskStats.reduce((s, t) => s + t.completedThisWeek * (XP_BY_PRIORITY[t.priority] ?? 10), 0);

      // --- Tracker series, this week vs last ---
      const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
      const trackers = (data.logTrackers || []).map(tr => {
        const thisWeek = tr.logs.filter(l => inWeek(l.date));
        const lastWeek = tr.logs.filter(l => {
          try {
            return isWithinInterval(parseISO(l.date), { start: prevStart, end: prevEnd });
          } catch {
            return false;
          }
        });
        return {
          name: tr.name,
          unit: tr.unit,
          thisWeekAvg: avg(thisWeek.map(l => l.value)),
          lastWeekAvg: avg(lastWeek.map(l => l.value)),
          values: thisWeek
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(l => ({ date: l.date, value: l.value })),
        };
      });

      // --- Journal entries from this week (trimmed, not full text) ---
      const journal = (data.journalEntries || [])
        .filter(e => {
          const ymd = (e.date || '').slice(0, 10);
          return inWeek(ymd);
        })
        .map(e => ({
          date: (e.date || '').slice(0, 10),
          mood: e.mood ?? null,
          tags: e.tags ?? null,
          excerpt: (e.content || '').replace(/\s+/g, ' ').slice(0, 400),
        }));

      if (totalCompletions === 0 && trackers.every(t => t.values.length === 0) && journal.length === 0) {
        setError('There is nothing logged for this week yet — complete a task, log a tracker or write a journal entry and check back.');
        setLoading(false);
        return;
      }

      try {
        const result = await generateWeeklyReview(
          {
            weekLabel: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
            tasks: taskStats,
            totalCompletions,
            totalPossible: Math.max(totalCompletions, (data.tasks || []).length),
            xpEarned,
            trackers,
            journal,
          },
          selectedModel
        );
        setReview(result);
      } catch (err: any) {
        setError(err?.message ?? 'Could not generate the review right now.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open, data, selectedModel, weekBounds]);

  const Section = ({
    icon: Icon,
    title,
    items,
  }: { icon: any; title: string; items?: string[] }) =>
    items && items.length > 0 ? (
      <div className="space-y-1.5">
        <p className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </p>
        <ul className="space-y-1 pl-6 list-disc text-sm text-muted-foreground marker:text-primary">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="text-primary" />
            Weekly Review
          </DialogTitle>
          <DialogDescription>
            {format(weekBounds.start, 'MMM d')} – {format(weekBounds.end, 'MMM d, yyyy')} · your tasks, trackers and journal read together.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-3 my-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <br />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}

        {!loading && error && <p className="my-4 text-sm text-muted-foreground">{error}</p>}

        {!loading && review && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 my-2">
              <p className="text-base font-medium text-foreground">{review.headline}</p>
              <Section icon={TrendingUp} title="What went well" items={review.wins} />
              <Section icon={AlertTriangle} title="Friction" items={review.frictions} />
              <Section icon={Link2} title="Patterns across your data" items={review.correlations} />
              <Section icon={Target} title="Focus next week" items={review.focusNextWeek} />
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="sm:justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1 pt-2">
            {review?.modelId && (
              <>
                <Cpu className="h-3 w-3" /> Generated by {review.modelId}
              </>
            )}
          </div>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
