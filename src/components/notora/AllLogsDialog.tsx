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

interface AllLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracker: LogTracker | null;
}

export default function AllLogsDialog({ open, onOpenChange, tracker }: AllLogsDialogProps) {
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
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {logsByMonth[monthKey].map(log => (
                            <TableRow key={log.id}>
                            <TableCell>{format(parseISO(log.date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="text-right">{log.value.toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-muted-foreground italic">{log.notes || '-'}</TableCell>
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
