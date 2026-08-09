
'use client';

import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Copy, Sparkles, Loader2, Check } from 'lucide-react';
import type { AppData, LogEntry, LogTracker } from '@/lib/types';
import { format, subDays, isAfter, parseISO, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useModelStore } from '@/hooks/use-model-store';
import { parseLogEntry } from '@/ai/flows/parse-log-entry';

interface AddNewLogCardProps {
  data: AppData;
  onDataChange: (data: AppData) => void;
}

/** Value + note the user has typed for one tracker, before saving. */
type DraftRow = { value: string; notes: string };

export default function AddNewLogCard({ data, onDataChange }: AddNewLogCardProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const [dayNotes, setDayNotes] = useState('');
  const [aiText, setAiText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();
  const { selectedModel } = useModelStore();

  const dateKey = format(date, 'yyyy-MM-dd');
  const trackers = data.logTrackers;

  /**
   * Whatever is already saved for the selected date. This is what makes the
   * card an edit surface as well as an entry surface — previously the only way
   * to correct a value was to blind-resubmit the same date, because nothing in
   * the UI showed you what was already there.
   */
  const existingForDate = useMemo(() => {
    const map: Record<string, LogEntry | undefined> = {};
    for (const t of trackers) map[t.id] = t.logs.find(l => l.date === dateKey);
    return map;
  }, [trackers, dateKey]);

  // Re-seed the draft whenever the date (or the tracker set) changes.
  useEffect(() => {
    const seeded: Record<string, DraftRow> = {};
    for (const t of trackers) {
      const existing = t.logs.find(l => l.date === dateKey);
      seeded[t.id] = { value: existing ? String(existing.value) : '', notes: existing?.notes ?? '' };
    }
    setDraft(seeded);
    setDayNotes('');
  }, [dateKey, trackers]);

  const setRow = (trackerId: string, patch: Partial<DraftRow>) =>
    setDraft(prev => ({ ...prev, [trackerId]: { ...(prev[trackerId] ?? { value: '', notes: '' }), ...patch } }));

  /** Rows the user actually filled in, with a usable number. */
  const filledRows = useMemo(
    () =>
      trackers
        .map(t => ({ tracker: t, row: draft[t.id] }))
        .filter(({ row }) => row && row.value.trim() !== '' && Number.isFinite(parseFloat(row.value))),
    [trackers, draft]
  );

  /** Rows whose value differs from what's already stored — the real work to do. */
  const changedRows = useMemo(
    () =>
      filledRows.filter(({ tracker, row }) => {
        const existing = existingForDate[tracker.id];
        if (!existing) return true;
        return existing.value !== parseFloat(row.value) || (row.notes ?? '') !== (existing.notes ?? '');
      }),
    [filledRows, existingForDate]
  );

  const handleSaveAll = () => {
    if (changedRows.length === 0) return;

    const changedById = new Map(changedRows.map(({ tracker, row }) => [tracker.id, row]));
    let added = 0;
    let updated = 0;

    const updatedTrackers: LogTracker[] = trackers.map(tracker => {
      const row = changedById.get(tracker.id);
      if (!row) return tracker;

      const numValue = parseFloat(row.value);
      // A per-tracker note (typed, or lifted from the AI parse) wins; otherwise
      // the shared day note is applied to each entry saved in this batch.
      const notes = row.notes.trim() || dayNotes.trim();
      const idx = tracker.logs.findIndex(l => l.date === dateKey);

      if (idx > -1) {
        const newLogs = [...tracker.logs];
        newLogs[idx] = { ...newLogs[idx], value: numValue, notes };
        updated++;
        return { ...tracker, logs: newLogs };
      }
      const newLog: LogEntry = { id: uuidv4(), date: dateKey, value: numValue, notes };
      added++;
      return { ...tracker, logs: [...tracker.logs, newLog] };
    });

    onDataChange({ ...data, logTrackers: updatedTrackers });

    const parts = [added && `${added} added`, updated && `${updated} updated`].filter(Boolean).join(', ');
    toast({
      title: `Logged ${changedRows.length} tracker${changedRows.length === 1 ? '' : 's'}`,
      description: `${parts} for ${format(date, 'PPP')}.`,
    });
  };

  const handleAiParse = async () => {
    const text = aiText.trim();
    if (!text) return;
    if (trackers.length === 0) {
      toast({ variant: 'destructive', title: 'No trackers yet', description: 'Create a tracker below first.' });
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseLogEntry(
        {
          naturalLanguageText: text,
          trackers: trackers.map(t => ({ id: t.id, name: t.name, unit: t.unit })),
          // Send the date computed in the browser's timezone so a late-evening
          // entry doesn't get filed against the previous UTC day.
          todayYmd: format(new Date(), 'yyyy-MM-dd'),
        },
        selectedModel
      );

      if (result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
        setDate(parseISO(result.date));
      }

      if (result.entries.length === 0) {
        toast({
          variant: 'destructive',
          title: "Couldn't match that to a tracker",
          description: result.unmatched?.length ? `Unmatched: ${result.unmatched.join(', ')}` : 'Try naming the tracker, e.g. "weight 94.2".',
        });
        return;
      }

      // Fill the form rather than saving outright — the user still reviews and
      // confirms, so a misparse never silently writes bad data.
      setDraft(prev => {
        const next = { ...prev };
        for (const e of result.entries) {
          next[e.trackerId] = { value: String(e.value), notes: e.notes ?? next[e.trackerId]?.notes ?? '' };
        }
        return next;
      });
      setAiText('');

      const names = result.entries
        .map(e => trackers.find(t => t.id === e.trackerId)?.name)
        .filter(Boolean)
        .join(', ');
      toast({
        title: `Filled ${result.entries.length} tracker${result.entries.length === 1 ? '' : 's'}`,
        description: `${names}. Review the values, then Save.${result.unmatched?.length ? ` Unmatched: ${result.unmatched.join(', ')}` : ''}`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not parse that', description: err?.message ?? 'Please try again or enter the values manually.' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleCopyLast7Days = () => {
    const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
    let report = `Log Summary - Last 7 Days (${format(sevenDaysAgo, 'MMM d')} - ${format(new Date(), 'MMM d')})\n\n`;

    data.logTrackers.forEach(tracker => {
      report += `--- ${tracker.name} (${tracker.unit}) ---\n`;
      const recentLogs = tracker.logs
        .filter(log => isAfter(parseISO(log.date), sevenDaysAgo))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (recentLogs.length > 0) {
        recentLogs.forEach(log => {
          report += `${format(parseISO(log.date), 'EEE, MMM d')}: ${log.value.toLocaleString()}${log.notes ? ` (${log.notes})` : ''}\n`;
        });
      } else {
        report += 'No entries in the last 7 days.\n';
      }
      report += '\n';
    });

    navigator.clipboard.writeText(report);
    toast({ title: 'Copied to Clipboard', description: 'Your log summary for the last 7 days has been copied.' });
  };

  const loggedCount = trackers.filter(t => existingForDate[t.id]).length;

  return (
    <Card className="dark:neon-logs">
      <CardHeader>
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div>
            <CardTitle>Log Your Day</CardTitle>
            <CardDescription>
              Fill in whatever you have — every tracker saves in one go.
              {trackers.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  {loggedCount}/{trackers.length} already logged for this date.
                </span>
              )}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyLast7Days} disabled={trackers.length === 0}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Last 7 Days
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Natural-language capture: one line instead of a pass per tracker. */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder='Type your day: "94.2kg, 12k steps, 2100 cal, 107g protein"'
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAiParse();
              }
            }}
            disabled={isParsing || trackers.length === 0}
            aria-label="Describe your day in plain language"
          />
          <Button onClick={handleAiParse} disabled={isParsing || !aiText.trim() || trackers.length === 0} className="shrink-0">
            {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isParsing ? 'Reading…' : 'Fill with AI'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={() => setDate(new Date())} disabled={dateKey === format(new Date(), 'yyyy-MM-dd')}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(d => subDays(d, 1))}>
            Previous day
          </Button>
        </div>

        {trackers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No trackers yet — create one below and it will show up here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            {trackers.map(tracker => {
              const row = draft[tracker.id] ?? { value: '', notes: '' };
              const existing = existingForDate[tracker.id];
              const isChanged = changedRows.some(c => c.tracker.id === tracker.id);
              return (
                <div key={tracker.id} className="flex items-center gap-2">
                  <label
                    htmlFor={`log-${tracker.id}`}
                    className="w-32 shrink-0 text-sm font-medium truncate flex items-center gap-1.5"
                    title={tracker.name}
                  >
                    {existing && !isChanged && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" aria-label="Already logged" />}
                    <span className="truncate">{tracker.name}</span>
                  </label>
                  <Input
                    id={`log-${tracker.id}`}
                    type="number"
                    inputMode="decimal"
                    className={cn('flex-1 min-w-0', isChanged && 'border-primary')}
                    placeholder={tracker.unit}
                    value={row.value}
                    onChange={e => setRow(tracker.id, { value: e.target.value })}
                    // Enter saves the whole batch. The old form had no keyboard
                    // submit at all, so logging was mouse-only.
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveAll();
                      }
                    }}
                  />
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">{tracker.unit}</span>
                </div>
              );
            })}
          </div>
        )}

        <Textarea
          placeholder="Notes for this day (optional) — applied to each entry you save…"
          value={dayNotes}
          onChange={e => setDayNotes(e.target.value)}
          rows={2}
          aria-label="Shared notes for this day"
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {changedRows.length === 0
              ? 'Nothing to save yet.'
              : `${changedRows.length} change${changedRows.length === 1 ? '' : 's'} ready — press Enter or Save.`}
          </p>
          <Button onClick={handleSaveAll} disabled={changedRows.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Save {changedRows.length > 0 ? `${changedRows.length} ` : ''}
            {changedRows.length === 1 ? 'entry' : 'entries'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
