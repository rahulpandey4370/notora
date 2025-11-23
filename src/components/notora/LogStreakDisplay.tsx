
'use client';

import { useMemo } from 'react';
import type { LogTracker } from '@/lib/types';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { Card, CardContent } from '../ui/card';
import { Flame, BookOpenText } from 'lucide-react';

interface LogStreakDisplayProps {
  logTrackers: LogTracker[];
}

const calculateStreak = (trackers: LogTracker[]): number => {
  if (trackers.length === 0) return 0;
  
  const allLogs = trackers.flatMap(tracker => tracker.logs);
  if (allLogs.length === 0) return 0;

  const entryDates = new Set(allLogs.map(log => format(parseISO(log.date), 'yyyy-MM-dd')));
  
  let currentStreak = 0;
  let today = new Date();

  // If there's an entry for today, the streak is at least 1
  if (entryDates.has(format(today, 'yyyy-MM-dd'))) {
    currentStreak = 1;
    let dayToCheck = subDays(today, 1);
    while (entryDates.has(format(dayToCheck, 'yyyy-MM-dd'))) {
      currentStreak++;
      dayToCheck = subDays(dayToCheck, 1);
    }
  }
  // If there's no entry for today, check if yesterday had an entry
  else {
    let yesterday = subDays(today, 1);
    if (entryDates.has(format(yesterday, 'yyyy-MM-dd'))) {
        currentStreak = 1;
        let dayToCheck = subDays(yesterday, 1);
        while (entryDates.has(format(dayToCheck, 'yyyy-MM-dd'))) {
            currentStreak++;
            dayToCheck = subDays(dayToCheck, 1);
        }
    }
  }

  return currentStreak;
};


export default function LogStreakDisplay({ logTrackers }: LogStreakDisplayProps) {
  const streak = useMemo(() => calculateStreak(logTrackers), [logTrackers]);
  const totalEntries = useMemo(() => logTrackers.reduce((sum, tracker) => sum + tracker.logs.length, 0), [logTrackers]);

  return (
    <Card className="dark:neon-border-yellow">
      <CardContent className="p-4 flex items-center justify-around text-center">
        <div className="flex items-center gap-3">
          <Flame className="w-8 h-8 text-orange-400" />
          <div>
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-xs text-muted-foreground">{streak === 1 ? 'Day Streak' : 'Day Streak'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <BookOpenText className="w-8 h-8 text-blue-400" />
          <div>
            <p className="text-2xl font-bold">{totalEntries}</p>
            <p className="text-xs text-muted-foreground">{totalEntries === 1 ? 'Total Log' : 'Total Logs'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
