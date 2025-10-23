
'use client';

import { useState, useMemo } from 'react';
import type { AppData, Task } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isSameDay, startOfDay, isWithinInterval, addDays, startOfWeek as dfStartOfWeek, endOfWeek as dfEndOfWeek, startOfYear as dfStartOfYear, startOfMonth as dfStartOfMonth, isSameMonth, isAfter } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

interface CalendarAnalysisProps {
  data: AppData;
}

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;


export default function CalendarAnalysis({ data }: CalendarAnalysisProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showTaskStatus, setShowTaskStatus] = useState(true);
  const [showLogActivity, setShowLogActivity] = useState(true);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | undefined>(data.logTrackers?.[0]?.id);

  const getTasksForDay = (day: Date): Task[] => {
    return data.tasks.filter(task => {
        const taskDay = startOfDay(day);
        switch (task.type) {
            case 'single':
                return task.date ? isSameDay(new Date(task.date), taskDay) : false;
            case 'recurring':
                const createdAt = startOfDay(new Date(task.createdAt));
                return isSameMonth(taskDay, createdAt) && (isSameDay(taskDay, createdAt) || isAfter(taskDay, createdAt));
            case 'weekly':
                if (!task.week) return false;
                const weekStartDate = dfStartOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
                return isWithinInterval(taskDay, { start: weekStartDate, end: dfEndOfWeek(weekStartDate, { weekStartsOn: 1 }) });
            case 'monthly':
                return task.month ? isSameMonth(taskDay, new Date(task.month)) : false;
            default:
                return false;
        }
    });
  };

 const modifiers = useMemo(() => {
    const taskModifiers: Record<string, Date[]> = {
      'task-complete': [],
      'task-partial': [],
      'task-low': [],
    };
    const logModifier: Record<string, Date[]> = { 'has-log': [] };

    if (showTaskStatus) {
      const year = currentMonth.getFullYear();
      const startDate = dfStartOfYear(new Date(year, 0, 1));
      const daysInYear = Array.from({length: 366}, (_, i) => addDays(startDate, i));

      daysInYear.forEach(day => {
          if (day.getFullYear() === year) {
              const dayStr = format(day, 'yyyy-MM-dd');
              const tasksForDay = getTasksForDay(day);
              if (tasksForDay.length === 0) return;
              
              const completedTasks = tasksForDay.filter(t => (t.completions || []).includes(dayStr));
              const percentage = (completedTasks.length / tasksForDay.length) * 100;
              
              if (percentage > 75) taskModifiers['task-complete'].push(day);
              else if (percentage >= 40) taskModifiers['task-partial'].push(day);
              else if (percentage > 0) taskModifiers['task-low'].push(day);
          }
      });
    }

    if (showLogActivity) {
      data.logTrackers.forEach(tracker => {
        tracker.logs.forEach(log => {
            logModifier['has-log'].push(startOfDay(new Date(log.date)));
        });
      });
    }

    return { ...taskModifiers, ...logModifier };
  }, [data, showTaskStatus, showLogActivity, currentMonth]);


  const analysisResult = useMemo(() => {
    if (!selectedRange?.from || !selectedTrackerId) return null;
    const to = selectedRange.to || selectedRange.from;
    const tracker = data.logTrackers.find(t => t.id === selectedTrackerId);
    if (!tracker) return null;

    const logsInRange = tracker.logs.filter(log => {
        const logDate = startOfDay(new Date(log.date));
        return isWithinInterval(logDate, { start: startOfDay(selectedRange.from!), end: startOfDay(to) });
    });

    if (logsInRange.length === 0) {
        return { total: 0, average: 0, count: 0, unit: tracker.unit };
    }

    const total = logsInRange.reduce((acc, log) => acc + log.value, 0);
    const average = total / logsInRange.length;

    return { total, average, count: logsInRange.length, unit: tracker.unit };
  }, [selectedRange, selectedTrackerId, data.logTrackers]);


  return (
    <Card className="dark:neon-border-blue">
      <CardHeader>
        <CardTitle>Calendar Analysis</CardTitle>
        <CardDescription>Visualize your activity and analyze trends over time.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col items-center">
            <style>{`
              .task-complete { background-color: var(--task-complete-bg); }
              .task-partial { background-color: var(--task-partial-bg); }
              .task-low { background-color: var(--task-low-bg); }
              .has-log { border: 2px solid hsl(var(--primary)); }
              .rdp-day_today { color: hsl(var(--chart-2)); font-weight: bold; }
            `}</style>
            <Calendar
                mode="range"
                selected={selectedRange}
                onSelect={setSelectedRange}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="p-0"
                numberOfMonths={isMobile ? 1 : 2}
                modifiers={modifiers}
                modifiersClassNames={{
                    today: 'rdp-day_today',
                    'task-complete': 'task-complete',
                    'task-partial': 'task-partial',
                    'task-low': 'task-low',
                    'has-log': 'has-log',
                }}
            />
            <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center space-x-2">
                    <Switch id="task-status" checked={showTaskStatus} onCheckedChange={setShowTaskStatus} />
                    <Label htmlFor="task-status">Show Task Progress</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="log-activity" checked={showLogActivity} onCheckedChange={setShowLogActivity} />
                    <Label htmlFor="log-activity">Show Log Activity</Label>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-green-500/20 dark:bg-green-800/30"></span>
                    <span>&gt;75% Done</span>
                </div>
                 <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-yellow-500/20 dark:bg-yellow-800/30"></span>
                    <span>40-75% Done</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-red-500/20 dark:bg-red-800/30"></span>
                    <span>&lt;40% Done</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm border-2 border-primary"></span>
                    <span>Log Entry</span>
                </div>
            </div>
        </div>
        <div className="space-y-4">
            <h4 className="font-semibold text-center md:text-left">Range Analysis</h4>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground text-center md:text-left flex-1">
                  {selectedRange?.from ? `Selected: ${format(selectedRange.from, 'PPP')} ${selectedRange.to ? ` - ${format(selectedRange.to, 'PPP')}` : ''}` : 'Select a date or range on the calendar to start.'}
              </p>
              {selectedRange && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedRange(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedRange?.from && (
                <div className="space-y-4">
                    <Select value={selectedTrackerId} onValueChange={setSelectedTrackerId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a tracker to analyze..." />
                        </SelectTrigger>
                        <SelectContent>
                            {data.logTrackers.map(tracker => (
                                <SelectItem key={tracker.id} value={tracker.id}>{tracker.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {analysisResult && (
                        <Card className="bg-muted/50">
                            <CardContent className="p-4 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Log Entries</span>
                                    <Badge variant="secondary">{analysisResult.count}</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Total</span>
                                    <span className="font-bold">{analysisResult.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {analysisResult.unit}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Average</span>
                                    <span className="font-bold">{analysisResult.average.toLocaleString(undefined, { maximumFractionDigits: 2 })} {analysisResult.unit}</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {!analysisResult && selectedTrackerId && (
                        <p className="text-sm text-muted-foreground text-center">No data for this tracker in the selected range.</p>
                    )}
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
