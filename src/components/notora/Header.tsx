'use client';

import { useState } from 'react';
import UserProfile from './UserProfile';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import DayEndSummaryDialog from './DayEndSummaryDialog';
import type { AppData, Task, User, UserStats } from '@/lib/types';
import { ModeToggle } from './ModeToggle';
import Link from 'next/link';

interface HeaderProps {
  user: User | null;
  tasks: Task[];
  userStats: UserStats;
  onDataChange: (data: AppData) => void;
}

export default function Header({ user, tasks, userStats, onDataChange }: HeaderProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);

  return (
    <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-sm z-20">
      <div className="flex items-center gap-2">
        <Link href="/" className='flex items-center gap-2'>
          <img src="https://placehold.co/32x32/FFDA63/000000.png?text=N" alt="Notora Logo" data-ai-hint="logo initial" className="rounded-md" />
          <h1 className="text-xl font-bold font-headline text-foreground hidden md:block">Notora</h1>
        </Link>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="outline" size="sm" onClick={() => setSummaryOpen(true)}>
          <Wand2 className="mr-0 md:mr-2 h-4 w-4" />
          <span className="hidden md:inline">Day End Summary</span>
        </Button>
        <ModeToggle />
        {user && <UserProfile user={user} userStats={userStats} />}
      </div>
      <DayEndSummaryDialog open={summaryOpen} onOpenChange={setSummaryOpen} tasks={tasks} />
    </header>
  );
}
