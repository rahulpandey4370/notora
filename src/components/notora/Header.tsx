
'use client';

import { useState } from 'react';
import UserProfile from './UserProfile';
import QuickFind from './QuickFind';
import { Button } from '@/components/ui/button';
import { Wand2, CalendarRange, Globe } from 'lucide-react';
import DayEndSummaryDialog from './DayEndSummaryDialog';
import type { Task, User, UserStats } from '@/lib/types';
import { ModeToggle } from './ModeToggle';
import SaveIndicator from './SaveIndicator';
import WeeklyReviewDialog from './WeeklyReviewDialog';
import { useApp } from '@/hooks/use-app';
import Link from 'next/link';
import { useModelStore } from '@/hooks/use-model-store';


interface HeaderProps {
  user: User | null;
  tasks: Task[];
  /** The workspace `tasks` came from is there (false while it loads: an empty list would read as "nothing done"). */
  loaded: boolean;
  userStats: UserStats;
}

export default function Header({ user, tasks, loaded, userStats }: HeaderProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const { data: appData } = useApp();
  const { webSearch, setWebSearch } = useModelStore();

  return (
    <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-sm z-20">
      <div className="flex items-center gap-2">
        <Link href="/" className='flex items-center gap-2'>
          <img src="/notora-logo.svg" alt="Notora" width="32" height="32" className="rounded-md" />
          <h1 className="text-xl font-bold font-headline text-foreground hidden md:block">Notora</h1>
        </Link>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant={webSearch ? 'default' : 'outline'} size="sm" aria-pressed={webSearch} onClick={() => setWebSearch(!webSearch)} className="hidden md:inline-flex"
          aria-label={`Web search ${webSearch ? 'on' : 'off'}`} title={webSearch ? 'Web search on: AI looks things up online' : 'Web search off'}>
          <Globe className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Web {webSearch ? 'on' : 'off'}</span>
        </Button>
        <SaveIndicator />

        <QuickFind />
        {/* Phones, signed in: these two live in the avatar menu, so the bar keeps to search, theme and you. */}
        <Button variant="outline" size="sm" onClick={() => setSummaryOpen(true)} className={user ? 'hidden md:inline-flex' : 'h-11 min-w-11 md:h-9'}>
          <Wand2 className="mr-0 md:mr-2 h-4 w-4" />
          <span className="hidden md:inline">Day End Summary</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeeklyOpen(true)} title="Cross-domain weekly review" className={user ? 'hidden md:inline-flex' : 'h-11 min-w-11 md:h-9'}>
          <CalendarRange className="mr-0 md:mr-2 h-4 w-4" />
          <span className="hidden lg:inline">Weekly Review</span>
        </Button>
        <ModeToggle />
        {user && <UserProfile user={user} userStats={userStats} onDayEnd={() => setSummaryOpen(true)} onWeekly={() => setWeeklyOpen(true)} />}
      </div>
      <WeeklyReviewDialog open={weeklyOpen} onOpenChange={setWeeklyOpen} data={appData} />
      <DayEndSummaryDialog open={summaryOpen} onOpenChange={setSummaryOpen} tasks={tasks} loaded={loaded} />
    </header>
  );
}
