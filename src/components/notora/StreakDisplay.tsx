
'use client';

import { useMemo } from 'react';
import type { JournalEntry } from '@/lib/types';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Flame, BookOpenText } from 'lucide-react';

interface StreakDisplayProps {
  journalEntries: JournalEntry[];
}

const calculateStreak = (entries: JournalEntry[]): number => {
  if (entries.length === 0) return 0;
  
  const entryDates = new Set(entries.map(e => format(parseISO(e.date), 'yyyy-MM-dd')));
  
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


export default function StreakDisplay({ journalEntries }: StreakDisplayProps) {
  const streak = useMemo(() => calculateStreak(journalEntries), [journalEntries]);
  const totalEntries = journalEntries.length;

  return (
    <Card className="dark:neon-journal">
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
            <p className="text-xs text-muted-foreground">{totalEntries === 1 ? 'Total Entry' : 'Total Entries'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
