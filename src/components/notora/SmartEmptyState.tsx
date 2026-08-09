'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Lightbulb } from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { AppData } from '@/lib/types';
import { useModelStore } from '@/hooks/use-model-store';
import { suggestNextActions } from '@/ai/flows/next-actions';

interface SmartEmptyStateProps {
  surface: 'tasks' | 'logs' | 'journal' | 'dashboard';
  data: AppData | null;
  /** The plain message shown before the user asks for suggestions. */
  message: string;
}

/**
 * An empty state that can tell you what's actually worth doing, instead of
 * just stating that nothing is here. The AI call is opt-in (a button) rather
 * than automatic, so an empty screen never silently costs a model request.
 */
export default function SmartEmptyState({ surface, data, message }: SmartEmptyStateProps) {
  const [nudges, setNudges] = useState<{ text: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedModel } = useModelStore();

  // Everything the nudge flow reasons about is computed locally first, so the
  // model only ever sees a small, already-relevant summary.
  const signals = useMemo(() => {
    const today = new Date();
    const todayYmd = format(today, 'yyyy-MM-dd');
    const daysAgo = (ymd: string) => {
      try { return differenceInCalendarDays(today, parseISO(ymd)); } catch { return 0; }
    };

    const staleTrackers = (data?.logTrackers ?? [])
      .map(t => {
        const last = t.logs.map(l => l.date).sort().pop();
        return last ? { name: t.name, daysSinceLastLog: daysAgo(last) } : { name: t.name, daysSinceLastLog: 999 };
      })
      .filter(t => t.daysSinceLastLog >= 2)
      .sort((a, b) => b.daysSinceLastLog - a.daysSinceLastLog)
      .slice(0, 5);

    const overdueTaskTitles = (data?.tasks ?? [])
      .filter(t => t.type === 'single' && t.date && t.date < todayYmd && !(t.completions ?? []).includes(t.date))
      .map(t => t.title)
      .slice(0, 5);

    const recurringTaskTitles = (data?.tasks ?? [])
      .filter(t => t.type === 'recurring' && !(t.completions ?? []).includes(todayYmd))
      .map(t => t.title)
      .slice(0, 5);

    const lastJournal = (data?.journalEntries ?? []).map(e => (e.date ?? '').slice(0, 10)).sort().pop();

    return {
      surface,
      todayYmd,
      staleTrackers,
      overdueTaskTitles,
      recurringTaskTitles,
      daysSinceLastJournal: lastJournal ? daysAgo(lastJournal) : null,
    };
  }, [data, surface]);

  const hasSignal =
    signals.staleTrackers.length > 0 ||
    signals.overdueTaskTitles.length > 0 ||
    signals.recurringTaskTitles.length > 0 ||
    (signals.daysSinceLastJournal ?? 0) >= 3;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await suggestNextActions(signals, selectedModel);
      setNudges(res.nudges.length ? res.nudges : []);
    } catch (err: any) {
      setError(err?.message ?? 'Could not fetch suggestions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>

      {loading && (
        <div className="w-full max-w-sm space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5 mx-auto" />
        </div>
      )}

      {!loading && nudges && nudges.length > 0 && (
        <ul className="text-sm text-left space-y-1.5 max-w-md">
          {nudges.map((n, i) => (
            <li key={i} className="flex gap-2 text-foreground">
              <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      )}

      {!loading && nudges && nudges.length === 0 && (
        <p className="text-xs text-muted-foreground">Nothing overdue or stale — you're clear.</p>
      )}

      {!loading && error && <p className="text-xs text-destructive">{error}</p>}

      {!loading && !nudges && hasSignal && (
        <Button variant="outline" size="sm" onClick={run}>
          <Sparkles className="mr-2 h-4 w-4" />
          What should I do next?
        </Button>
      )}
    </div>
  );
}
