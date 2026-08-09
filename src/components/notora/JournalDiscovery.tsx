
'use client';

import { useMemo } from 'react';
import { isSameDay, format, getYear , parseISO} from 'date-fns';
import type { JournalEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, History, Shuffle } from 'lucide-react';
import Link from 'next/link';

interface JournalDiscoveryProps {
  entries: JournalEntry[];
  onDateSelect: (date: Date) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export default function JournalDiscovery({ entries, onDateSelect, searchQuery, onSearchQueryChange }: JournalDiscoveryProps) {
  const onThisDayEntries = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    return entries.filter(entry => {
      const entryDate = parseISO(entry.date);
      return (
        entryDate.getMonth() === currentMonth &&
        entryDate.getDate() === currentDay &&
        entryDate.getFullYear() !== currentYear
      );
    });
  }, [entries]);

  const handleRandomEntry = () => {
    if (entries.length === 0) return;
    const randomIndex = Math.floor(Math.random() * entries.length);
    const randomEntry = entries[randomIndex];
    if (randomEntry) {
      onDateSelect(new Date(randomEntry.date));
    }
  };

  return (
    <Card className="dark:neon-journal">
      <CardHeader>
        <CardTitle>Discovery</CardTitle>
        <CardDescription>Search and rediscover your past entries.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
          <Button variant="ghost" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2"><History className="h-4 w-4"/>On This Day</h4>
            {onThisDayEntries.length > 0 ? (
                <div className="space-y-1">
                {onThisDayEntries.map(entry => (
                    <Button
                        key={entry.id}
                        variant="link"
                        className="p-0 h-auto text-muted-foreground"
                        onClick={() => onDateSelect(parseISO(entry.date))}
                    >
                        {getYear(parseISO(entry.date))}
                    </Button>
                ))}
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">No entries from this day in past years.</p>
            )}
        </div>

        <div>
            <Button variant="outline" className="w-full" onClick={handleRandomEntry}>
                <Shuffle className="mr-2 h-4 w-4" /> Random Entry
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
