'use client';

import { useState } from 'react';
import UserProfile from './UserProfile';
import { Button } from '@/components/ui/button';
import { Wand2, Cpu } from 'lucide-react';
import DayEndSummaryDialog from './DayEndSummaryDialog';
import type { Task, User, UserStats } from '@/lib/types';
import { ModeToggle } from './ModeToggle';
import Link from 'next/link';
import { useModelStore } from '@/hooks/use-model-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


interface HeaderProps {
  user: User | null;
  tasks: Task[];
  userStats: UserStats;
}

export default function Header({ user, tasks, userStats }: HeaderProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const { availableModels, selectedModel, setModel } = useModelStore();

  return (
    <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-sm z-20">
      <div className="flex items-center gap-2">
        <Link href="/" className='flex items-center gap-2'>
          <img src="https://placehold.co/32x32/FFDA63/000000.png?text=N" alt="Notora Logo" data-ai-hint="logo initial" className="rounded-md" />
          <h1 className="text-xl font-bold font-headline text-foreground hidden md:block">Notora</h1>
        </Link>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Cpu className="mr-0 md:mr-2 h-4 w-4" />
              <span className="hidden md:inline">{selectedModel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={selectedModel} onValueChange={(v) => setModel(v as any)}>
              {availableModels.map(modelId => (
                <DropdownMenuRadioItem key={modelId} value={modelId}>{modelId}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

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
