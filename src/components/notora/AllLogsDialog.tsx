'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LogTracker, LogEntry } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface AllLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracker: LogTracker | null;
  /** Remove a single entry. Until now this history view was read-only, so a
   *  mistyped value could never actually be deleted from anywhere in the app. */
  onDeleteLog?: (trackerId: string, logId: string) => void;
}

export default function AllLogsDialog({ open, onOpenChange, tracker, onDeleteLog }: AllLogsDialogProps) {
  const logsByMonth = useMemo(() => {
    if (!tracker) return {};

    return tracker.logs
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .reduce((acc, log) => {
        const monthKey = format(parseISO(log.date), 'yyyy-MM');
        if (!acc[monthKey]) {
          acc[monthKey] = [];
        }
        acc[monthKey].push(log);
        return acc;
      }, {} as Record<string, LogEntry[]>);
  }, [tracker]);

  const sortedMonths = useMemo(() => Object.keys(logsByMonth).sort().reverse(), [logsByMonth]);

  if (!tracker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>All Logs for "{tracker.name}"</DialogTitle>
          <DialogDescription>A complete history of your tracked data, organized by month.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <Accordion type="single" collapsible className="w-full" defaultValue={sortedMonths[0]}>
            {sortedMonths.length > 0 ? (
                sortedMonths.map(monthKey => (
                <AccordionItem value={monthKey} key={monthKey}>
                    <AccordionTrigger>
                    {format(parseISO(`${monthKey}-01`), 'MMMM yyyy')}
                    </AccordionTrigger>
                    <AccordionContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Date</TableHead>
                            <TableHead className="w-[100px] text-right">Value ({tracker.unit})</TableHead>
                            <TableHead>Notes</TableHead>
                            {onDeleteLog && <TableHead className="w-[48px]"><span className="sr-only">Delete</span></TableHead>}
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {logsByMonth[monthKey].map(log => (
                            <TableRow key={log.id}>
                            <TableCell>{format(parseISO(log.date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="text-right">{log.value.toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-muted-foreground italic">{log.notes || '-'}</TableCell>
                            {onDeleteLog && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  aria-label={`Delete ${format(parseISO(log.date), 'MMM d, yyyy')} entry`}
                                  onClick={() => onDeleteLog(tracker.id, log.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            )}
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </AccordionContent>
                </AccordionItem>
                ))
            ) : (
                <p className="text-center text-muted-foreground pt-10">No logs found for this tracker.</p>
            )}
          </Accordion>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
