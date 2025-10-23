
'use client';

import { useState, useMemo } from 'react';
import type { AppData, LogTracker, Task } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isSameDay, startOfDay, isWithinInterval, addDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

interface CalendarAnalysisProps {
  data: AppData;
}

export default function CalendarAnalysis({ data }: CalendarAnalysisProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showTaskStatus, setShowTaskStatus] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | undefined>(data.logTrackers?.[0]?.id);

  const getTasksForDay = (day: Date, tasks: Task[]): Task[] => {
    return tasks.filter(task => {
        const taskDay = startOfDay(day);
        switch (task.type) {
            case 'single':
                return task.date ? isSameDay(new Date(task.date), taskDay) : false;
            case 'recurring':
                const createdAt = startOfDay(new Date(task.createdAt));
                return isWithinInterval(taskDay, { start: createdAt, end: addDays(createdAt, 365) }); // Assume recurring for a year
            case 'weekly':
                if (!task.week) return false;
                const weekStartDate = new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1'));
                return isWithinInterval(taskDay, { start: startOfWeek(weekStartDate), end: endOfWeek(weekStartDate) });
            case 'monthly':
                return task.month ? isSameDay(new Date(task.month), startOfMonth(taskDay)) : false;
            default:
                return false;
        }
    });
  };

  const taskCompletionMap = useMemo(() => {
    if (!showTaskStatus) return new Map();
    const map = new Map<string, 'all' | 'partial' | 'none'>();
    const date = new Date();
    const daysInYear = Array.from({length: 366}, (_, i) => addDays(startOfYear(date), i));

    daysInYear.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const tasksForDay = getTasksForDay(day, data.tasks);
        if (tasksForDay.length === 0) {
            map.set(dayStr, 'none');
            return;
        }
        const completedTasks = tasksForDay.filter(t => t.completions?.includes(dayStr));
        if (completedTasks.length === tasksForDay.length) {
            map.set(dayStr, 'all');
        } else if (completedTasks.length > 0) {
            map.set(dayStr, 'partial');
        } else {
            map.set(dayStr, 'none');
        }
    });
    return map;
  }, [data.tasks, showTaskStatus]);

  const logActivityMap = useMemo(() => {
    if (!showLogActivity) return new Map();
    const map = new Map<string, boolean>();
    data.logTrackers.forEach(tracker => {
        tracker.logs.forEach(log => {
            map.set(log.date, true);
        });
    });
    return map;
  }, [data.logTrackers, showLogActivity]);

  const modifiers = {
    allTasksCompleted: (day: Date) => {
      if (!showTaskStatus) return false;
      const status = taskCompletionMap.get(format(day, 'yyyy-MM-dd'));
      return status === 'all';
    },
    partialTasksCompleted: (day: Date) => {
        if (!showTaskStatus) return false;
        const status = taskCompletionMap.get(format(day, 'yyyy-MM-dd'));
        return status === 'partial';
    },
    hasLogs: (day: Date) => {
        if (!showLogActivity) return false;
        return logActivityMap.has(format(day, 'yyyy-MM-dd'));
    }
  };

  const modifiersClassNames = {
    allTasksCompleted: 'bg-green-200 dark:bg-green-800/50 rounded-full',
    partialTasksCompleted: 'bg-yellow-200 dark:bg-yellow-800/50 rounded-full',
    hasLogs: 'border-2 border-primary rounded-full',
  };

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
            <Calendar
                mode="range"
                selected={selectedRange}
                onSelect={setSelectedRange}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
                className="p-0"
                numberOfMonths={isMobile ? 1 : 2}
            />
            <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center space-x-2">
                    <Switch id="task-status" checked={showTaskStatus} onCheckedChange={setShowTaskStatus} />
                    <Label htmlFor="task-status">Show Task Status</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="log-activity" checked={showLogActivity} onCheckedChange={setShowLogActivity} />
                    <Label htmlFor="log-activity">Show Log Activity</Label>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-200 dark:bg-green-800/50"></span>
                    <span>All Tasks Done</span>
                </div>
                 <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-yellow-200 dark:bg-yellow-800/50"></span>
                    <span>Partial</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full border-2 border-primary"></span>
                    <span>Log Entry</span>
                </div>
            </div>
        </div>
        <div className="space-y-4">
            <h4 className="font-semibold text-center md:text-left">Range Analysis</h4>
            <p className="text-sm text-muted-foreground text-center md:text-left">
                {selectedRange?.from ? `Selected: ${format(selectedRange.from, 'PPP')} ${selectedRange.to ? ` - ${format(selectedRange.to, 'PPP')}` : ''}` : 'Select a date or range on the calendar to start.'}
            </p>
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

const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfWeek = (date: Date) => addDays(startOfWeek(date), 6);
const startOfWeek = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
}

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

