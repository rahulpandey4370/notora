
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

interface CalendarAnalysisProps {
  data: AppData;
}

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

function CustomDay({ date, completionPercentage, hasLogs, isSelected, isRangeStart, isRangeEnd }: { date: Date, completionPercentage: number | null, hasLogs: boolean, isSelected: boolean, isRangeStart: boolean, isRangeEnd: boolean }) {
  const dayNumber = format(date, 'd');
  
  let bgColor = 'bg-transparent';
  let textColor = 'text-current';

  if (completionPercentage !== null) {
    if (completionPercentage > 75) {
      bgColor = 'bg-green-500/20 dark:bg-green-800/30';
    } else if (completionPercentage >= 40) {
      bgColor = 'bg-yellow-500/20 dark:bg-yellow-800/30';
    } else if (completionPercentage > 0) {
        bgColor = 'bg-red-500/20 dark:bg-red-800/30';
    }
  }
  
  if (isSelected) {
    bgColor = 'bg-primary';
    textColor = 'text-primary-foreground';
  }

  return (
    <div 
        className={cn("relative w-full h-full flex items-center justify-center rounded-md transition-colors", 
            bgColor,
            hasLogs && "border-2 border-primary",
            isRangeStart && "rounded-r-none",
            isRangeEnd && "rounded-l-none"
        )}
    >
        {completionPercentage !== null && (
            <motion.div 
                className={cn(
                    "absolute bottom-0 left-0 h-1 rounded-b-md",
                    completionPercentage > 75 ? "bg-green-500" :
                    completionPercentage >= 40 ? "bg-yellow-500" :
                    "bg-red-500"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            />
        )}
      <span className={cn("relative z-10", textColor)}>{dayNumber}</span>
    </div>
  );
}

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

  const taskCompletionMap = useMemo(() => {
    if (!showTaskStatus) return new Map();
    const map = new Map<string, number>();
    
    const year = currentMonth.getFullYear();
    const startDate = dfStartOfYear(new Date(year, 0, 1));
    const daysInYear = Array.from({length: 366}, (_, i) => addDays(startDate, i));

    daysInYear.forEach(day => {
        if (day.getFullYear() === year) {
            const dayStr = format(day, 'yyyy-MM-dd');
            const tasksForDay = getTasksForDay(day);
            if (tasksForDay.length === 0) {
                map.set(dayStr, 0);
                return;
            }
            const completedTasks = tasksForDay.filter(t => (t.completions || []).includes(dayStr));
            const percentage = (completedTasks.length / tasksForDay.length) * 100;
            map.set(dayStr, percentage);
        }
    });
    return map;
  }, [data.tasks, showTaskStatus, currentMonth]);

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
                className="p-0"
                numberOfMonths={isMobile ? 1 : 2}
                components={{
                  Day: ({ date }) => {
                    const dayStr = format(date, 'yyyy-MM-dd');
                    const completionPercentage = showTaskStatus ? taskCompletionMap.get(dayStr) ?? null : null;
                    const hasLogs = showLogActivity && logActivityMap.has(dayStr);
                    const isSelected = selectedRange?.from ? (selectedRange.to ? isWithinInterval(date, {start: startOfDay(selectedRange.from), end: startOfDay(selectedRange.to)}) : isSameDay(date, selectedRange.from)) : false;
                    const isRangeStart = selectedRange?.from && isSameDay(date, selectedRange.from);
                    const isRangeEnd = selectedRange?.to && isSameDay(date, selectedRange.to);
                    
                    return (
                        <CustomDay 
                            date={date} 
                            completionPercentage={completionPercentage}
                            hasLogs={hasLogs}
                            isSelected={isSelected}
                            isRangeStart={isRangeStart}
                            isRangeEnd={isRangeEnd}
                        />
                    );
                  },
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
                    <span className="w-3 h-1 rounded-full bg-green-500"></span>
                    <span>&gt;75% Done</span>
                </div>
                 <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 rounded-full bg-yellow-500"></span>
                    <span>40-75% Done</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 rounded-full bg-red-500"></span>
                    <span>&lt;40% Done</span>
                </div>
                <div className="flex items-center gap-1.5">
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

    