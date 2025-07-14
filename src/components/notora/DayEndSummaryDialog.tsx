'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { generateDayEndSummary } from '@/ai/flows/day-end-summary';
import type { Task } from '@/lib/types';
import { Sparkle } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';

interface DayEndSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
}

export default function DayEndSummaryDialog({ open, onOpenChange, tasks }: DayEndSummaryDialogProps) {
  const [summary, setSummary] = useState('');
  const [quote, setQuote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchSummary = async () => {
        setLoading(true);
        setSummary('');
        setQuote('');
        
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const completedTasks = tasks
          .filter((task) => (task.completions || []).includes(todayStr))
          .map((task) => task.title);

        if (completedTasks.length === 0) {
          setSummary("You didn't complete any tasks today. Let's aim to get at least one done tomorrow!");
          setQuote("The secret of getting ahead is getting started. - Mark Twain");
          setLoading(false);
          return;
        }

        try {
          const result = await generateDayEndSummary({ completedTasks });
          setSummary(result.summary);
          setQuote(result.motivationalQuote);
        } catch (error) {
          console.error('Failed to generate summary:', error);
          setSummary('Could not generate summary at this time.');
          setQuote('Every moment is a fresh beginning. - T.S. Eliot');
        } finally {
          setLoading(false);
        }
      };

      fetchSummary();
    }
  }, [open, tasks]);

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
            <p className="font-semibold text-foreground">Your Accomplishments:</p>
            <p className="text-muted-foreground mb-4">{summary}</p>
            <p className="font-semibold text-foreground">Food for Thought:</p>
            <blockquote className="border-l-2 border-primary pl-4 italic text-muted-foreground">
                "{quote}"
            </blockquote>
            </div>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
