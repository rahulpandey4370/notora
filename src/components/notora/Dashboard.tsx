'use client';

import type { User, AppData, Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import TaskList from './TaskList';
import { useMemo } from 'react';
import { Award, CheckSquare, StickyNote, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { isSameDay, format } from 'date-fns';

interface DashboardProps {
  user: User;
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function Dashboard({ user, data, onDataChange }: DashboardProps) {
  const { noteBoards, userStats } = data;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const todaysTasks = useMemo(() => {
    return data.tasks.filter(task => {
        if (task.type === 'recurring') return true;
        if (task.type === 'single' && task.date) {
            return isSameDay(new Date(task.date), today);
        }
        return false;
    });
  }, [data.tasks, today]);

  const progress = useMemo(() => {
    if (todaysTasks.length === 0) return 0;
    const completedTasks = todaysTasks.filter((task) => task.completions.includes(todayStr)).length;
    return (completedTasks / todaysTasks.length) * 100;
  }, [todaysTasks, todayStr]);

  const recentNotes = useMemo(() => {
    return noteBoards.flatMap(board => board.notes).slice(0, 3);
  }, [noteBoards]);

  return (
    <div className="p-4 md:p-8 space-y-6">
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
            {todaysTasks.filter(t => t.completions.includes(todayStr)).length} of {todaysTasks.length} tasks completed today. Keep going!
          </p>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="w-5 h-5" />
                      Today's Tasks
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                      <Link href="/tasks">View All Tasks <ArrowRight className="ml-2 w-4 h-4"/></Link>
                  </Button>
              </CardHeader>
              <CardContent>
                 <TaskList 
                    tasks={todaysTasks}
                    onDataChange={onDataChange}
                    data={data}
                    selectedDate={today}
                    taskType="single"
                 />
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                      <StickyNote className="w-5 h-5" />
                      Recent Notes
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                      <Link href="/notes">View All Notes <ArrowRight className="ml-2 w-4 h-4"/></Link>
                  </Button>
              </CardHeader>
              <CardContent>
                 {recentNotes.length > 0 ? (
                      <div className="space-y-2">
                          {recentNotes.map(note => (
                              <div key={note.id} className="p-2 rounded-md bg-secondary/50">
                                  <p className="text-sm text-muted-foreground truncate">{note.content || "Empty Note"}</p>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No recent notes.</p>
                  )}
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
