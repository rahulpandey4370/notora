'use client';

import type { User, AppData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import TaskList from './TaskList';
import { useMemo } from 'react';
import { Award, CheckSquare, StickyNote, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';

interface DashboardProps {
  user: User;
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function Dashboard({ user, data, onDataChange }: DashboardProps) {
  const { tasks, noteBoards, userStats } = data;

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter((task) => task.completed).length;
    return (completedTasks / tasks.length) * 100;
  }, [tasks]);

  const recentNotes = useMemo(() => {
    return noteBoards.flatMap(board => board.notes).slice(0, 3);
  }, [noteBoards]);
  
  const uncompletedTasks = useMemo(() => {
    return tasks.filter(task => !task.completed).slice(0, 5);
  }, [tasks]);

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
            {tasks.filter(t => t.completed).length} of {tasks.length} tasks completed. Keep going!
          </p>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="w-5 h-5" />
                      Upcoming Tasks
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                      <Link href="/tasks">View All <ArrowRight className="ml-2 w-4 h-4"/></Link>
                  </Button>
              </CardHeader>
              <CardContent>
                  {uncompletedTasks.length > 0 ? (
                      <div className="space-y-2">
                          {uncompletedTasks.map(task => (
                              <div key={task.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                                  <span className="text-sm">{task.title}</span>
                                  <span className="text-xs text-muted-foreground">{task.priority}</span>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No upcoming tasks. Great job!</p>
                  )}
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                      <StickyNote className="w-5 h-5" />
                      Recent Notes
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                      <Link href="/notes">View All <ArrowRight className="ml-2 w-4 h-4"/></Link>
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
