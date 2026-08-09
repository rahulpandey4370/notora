
'use client';

import { useState } from 'react';
import UserProfile from './UserProfile';
import { Button } from '@/components/ui/button';
import { Wand2, Cpu, CalendarRange } from 'lucide-react';
import DayEndSummaryDialog from './DayEndSummaryDialog';
import type { Task, User, UserStats } from '@/lib/types';
import { ModeToggle } from './ModeToggle';
import SaveIndicator from './SaveIndicator';
import WeeklyReviewDialog from './WeeklyReviewDialog';
import { useApp } from '@/hooks/use-app';
import Link from 'next/link';
import { useModelStore } from '@/hooks/use-model-store';
import { PROVIDER_LABELS, PROVIDER_ORDER, TAG_LABELS } from '@/lib/model-catalog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

/** Sub-dollar rates need cents ($0.20, not $0.2); whole rates don't. */
const usd = (n: number) => (n < 1 || !Number.isInteger(n) ? `$${n.toFixed(2)}` : `$${n}`);

export default function Header({ user, tasks, userStats }: HeaderProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const { data: appData } = useApp();
  const { availableModels, selectedModel, setModel } = useModelStore();

  // Grouped by provider rather than by "starts with gemini": that string test
  // put Claude models under an "OpenAI" heading and couldn't tell a first-party
  // OpenAI model from an Azure deployment sharing the same id.
  const grouped = PROVIDER_ORDER
    .map(provider => ({ provider, models: availableModels.filter(m => m.provider === provider) }))
    .filter(g => g.models.length > 0);

  const activeModel = availableModels.find(m => m.key === selectedModel);


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
            <Button variant="outline" size="sm" aria-label={`AI model: ${activeModel?.label ?? selectedModel}. Change model.`}>
              <Cpu className="mr-0 md:mr-2 h-4 w-4" />
              <span className="hidden max-w-[140px] truncate md:inline">
                {activeModel?.label ?? selectedModel}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[70vh] w-72 overflow-y-auto">
            <DropdownMenuLabel>Select AI model</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={selectedModel} onValueChange={(v) => setModel(v)}>
              {grouped.map(({ provider, models }, gi) => (
                <DropdownMenuGroup key={provider}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {PROVIDER_LABELS[provider]}
                  </DropdownMenuLabel>
                  {models.map(model => (
                    <DropdownMenuRadioItem key={model.key} value={model.key} className="flex-col items-start gap-0.5 py-2">
                      <div className="flex w-full items-center gap-2">
                        <span className="flex-1 truncate">{model.label}</span>
                        {model.tags.slice(0, 1).map(tag => (
                          <span key={tag} className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {TAG_LABELS[tag]}
                          </span>
                        ))}
                      </div>
                      {model.inputPerMTok !== undefined && model.outputPerMTok !== undefined && (
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {usd(model.inputPerMTok)} in / {usd(model.outputPerMTok)} out per M tokens
                        </span>
                      )}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <SaveIndicator />

        <Button variant="outline" size="sm" onClick={() => setSummaryOpen(true)}>
          <Wand2 className="mr-0 md:mr-2 h-4 w-4" />
          <span className="hidden md:inline">Day End Summary</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeeklyOpen(true)} title="Cross-domain weekly review">
          <CalendarRange className="mr-0 md:mr-2 h-4 w-4" />
          <span className="hidden lg:inline">Weekly Review</span>
        </Button>
        <ModeToggle />
        {user && <UserProfile user={user} userStats={userStats} />}
      </div>
      <WeeklyReviewDialog open={weeklyOpen} onOpenChange={setWeeklyOpen} data={appData} />
      <DayEndSummaryDialog open={summaryOpen} onOpenChange={setSummaryOpen} tasks={tasks} />
    </header>
  );
}
