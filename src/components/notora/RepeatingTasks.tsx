import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Repeat } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { AppData } from '@/lib/types';
import { isRepeating, resumeRepeating, stopRepeating } from '@/lib/tasks';
import { cn } from '@/lib/utils';

/**
 * Every recurring and monthly task with a "Repeats" switch. Off = gone from tomorrow
 * (next month for monthly), still on earlier days; on = carries on again.
 */
export default function RepeatingTasks({ data, onDataChange }: { data: AppData; onDataChange: (d: AppData) => void }) {
  const [open, setOpen] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');
  // Old copies kept for their own month (ongoing: false) are history, not settings.
  const tasks = data.tasks.filter(t => (t.type === 'recurring' || t.type === 'monthly') && t.ongoing);
  if (!tasks.length) return null;
  const on = tasks.filter(t => isRepeating(t)).length;

  const set = (id: string, repeat: boolean) =>
    onDataChange({ ...data, tasks: data.tasks.map(t => (t.id !== id ? t : repeat ? resumeRepeating(t) : stopRepeating(t, today))) });

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Repeat className="h-4 w-4" />Repeating tasks <Badge variant="secondary">{on} on</Badge></CardTitle>
            <CardDescription>They carry on every day (or month) until you switch them off. Switching off keeps them on earlier days.</CardDescription>
          </div>
          <ChevronDown className={cn('h-5 w-5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <ul className="divide-y">
            {tasks.map(t => {
              const repeating = isRepeating(t);
              return (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.type === 'monthly' ? 'Every month' : 'Every day'}
                      {!repeating && t.endsOn ? ` · ended ${format(new Date(`${t.endsOn}T00:00:00`), t.type === 'monthly' ? 'MMM yyyy' : 'd MMM')}` : ''}
                    </span>
                  </span>
                  <Switch checked={repeating} onCheckedChange={v => set(t.id, v)} aria-label={`${t.title} repeats`} />
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
