
'use client';

import { useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { generateDayEndSummary, type DayEndSummaryOutput } from '@/ai/flows/day-end-summary';
import type { Task } from '@/lib/types';
import { Sparkle, Cpu } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { useModelFor } from '@/hooks/use-model-store';
import { useAsk } from '@/hooks/use-ask';
import { dayEndInput } from '@/lib/review-input';

interface DayEndSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  /** The workspace is there. Until then the dialog waits: an empty list would read as "nothing done today". */
  loaded: boolean;
}

const showNotification = (title: string, options: NotificationOptions) => {
  if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        ...options,
        icon: '/notora.png',
        badge: '/notora.png',
      });
    });
  }
};


// Shown, and sent as the notification, when the AI fails: there is no summary then, only this.
const FALLBACK_QUOTE = 'Every moment is a fresh beginning. - T.S. Eliot';

export default function DayEndSummaryDialog({ open, onOpenChange, tasks, loaded }: DayEndSummaryDialogProps) {
  // lib/ask: idle (not opened yet, or waiting for the workspace) → pending → ready | failed.
  const sum = useAsk<DayEndSummaryOutput>();
  const selectedModel = useModelFor('summaries');
  const loading = sum.pending || sum.state.state === 'idle';
  const quote = sum.error ? FALLBACK_QUOTE : sum.value?.motivationalQuote ?? '';

  // Today's ticked tasks (lib/review-input), null while closed or not loaded. The AI is asked when this is first
  // there and again only if it changes: a save that ticks nothing asks nothing and sends no second notification,
  // while fresher data arriving a moment after opening (a reload, the server copy) corrects the summary.
  const completedTasks = useMemo(
    () => (open ? dayEndInput(loaded ? tasks : undefined, format(new Date(), 'yyyy-MM-dd')) : null),
    [open, loaded, tasks],
  );
  const key = completedTasks ? JSON.stringify(completedTasks) : '';
  useEffect(() => {
    if (!completedTasks) { if (sum.pending) sum.reset(); return; } // closed: a reply still on its way is dropped
    let live = true; // false once closed or superseded, so a dropped reply sends no notification either
    const notify = (body: string) => { if (live) showNotification("Today's Wrap-Up", { body }); };

    if (completedTasks.length === 0) {
      const defaultSummary = "You didn't complete any tasks today. Let's aim to get at least one done tomorrow!";
      const defaultQuote = "The secret of getting ahead is getting started. - Mark Twain";
      sum.set({ summary: defaultSummary, motivationalQuote: defaultQuote });
      notify(defaultQuote);
    } else {
      // `run` resolves to nothing for a failure: while still open, that is the only way to get nothing.
      void sum.run(() => generateDayEndSummary({ completedTasks }, selectedModel), {
        error: (error) => { console.error('Failed to generate summary:', error); return 'Could not generate summary at this time.'; },
      }).then((result) => notify(result?.motivationalQuote ?? FALLBACK_QUOTE));
    }
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkle className="text-primary" />
            Day-End Summary
          </DialogTitle>
          <DialogDescription>
            Here's a wrap-up of your achievements today.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
            <div className="space-y-4 my-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <br />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-5/6" />
            </div>
        ) : (
            <div className="my-4 text-sm">
            {sum.error ? (
            <p role="alert" className="text-destructive mb-4">{sum.error}</p>
            ) : (<>
            <p className="font-semibold text-foreground">Your Accomplishments:</p>
            <p className="text-muted-foreground mb-4">{sum.value?.summary}</p>
            </>)}
            <p className="font-semibold text-foreground">Food for Thought:</p>
            <blockquote className="border-l-2 border-primary pl-4 italic text-muted-foreground">
                "{quote}"
            </blockquote>
            </div>
        )}
        <DialogFooter className="sm:justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-1 pt-2">
                {sum.value?.modelId && <><Cpu className="h-3 w-3" /> Generated by {sum.value.modelId}</>}
            </div>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    