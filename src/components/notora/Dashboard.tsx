'use client';

import type { User, AppData } from '@/lib/types';
import Header from './Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import TaskList from './TaskList';
import StickyNotesBoard from './StickyNotesBoard';
import { useMemo } from 'react';
import { Award } from 'lucide-react';

interface DashboardProps {
  user: User;
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function Dashboard({ user, data, onDataChange }: DashboardProps) {
  const { tasks, notes, userStats } = data;

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter((task) => task.completed).length;
    return (completedTasks / tasks.length) * 100;
  }, [tasks]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header user={user} tasks={tasks} onDataChange={onDataChange} userStats={userStats} />

      <main className="flex-1 p-4 md:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8">
          <div className="xl:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Today's Progress</CardTitle>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Award className="w-5 h-5" />
                    <span>{userStats.xp} XP</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>
                  <Progress value={progress} className="w-full" />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {tasks.filter(t => t.completed).length} of {tasks.length} tasks completed. Keep going!
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskList tasks={tasks} onDataChange={onDataChange} data={data} />
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-1">
             <Card className="h-full min-h-[400px] lg:min-h-0">
                <CardHeader>
                    <CardTitle>Sticky Notes</CardTitle>
                </CardHeader>
                <CardContent>
                    <StickyNotesBoard notes={notes} onDataChange={onDataChange} data={data} />
                </CardContent>
             </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
