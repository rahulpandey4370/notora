
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import TaskList from '@/components/notora/TaskList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ClipboardList, CalendarDays } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek, eachWeekOfInterval, getWeek, isSameWeek, startOfDay, addDays, subDays } from 'date-fns';
import type { Task } from '@/lib/types';
import TaskItem from '@/components/notora/TaskItem';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const getTaskXp = (task: Task): number => {
    const dailyXp: Record<Task['priority'], number> = {
        Easy: 10,
        Medium: 25,
        Hard: 50,
    };
    const monthlyXp: Record<Task['priority'], number> = {
        Easy: 50,
        Medium: 100,
        Hard: 200,
    };

    if (task.type === 'monthly') {
        return monthlyXp[task.priority];
    }
    return dailyXp[task.priority];
};

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, loading: appLoading, handleDataChange, toast } = useApp();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentDay, setCurrentDay] = useState(new Date());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);
  
  const handlePreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setCurrentDay(newMonth);
  };
  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setCurrentDay(newMonth);
  };

  const handlePreviousDay = () => setCurrentDay(subDays(currentDay, 1));
  const handleNextDay = () => setCurrentDay(addDays(currentDay, 1));


  if (authLoading || appLoading || !data || !user) {
    return (
      <AppLayout>
        <div className="p-4 md:p-8 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }
  
  const onToggle = (id: string, date: Date) => {
    let xpChange = 0;
    const newTasks = data.tasks.map((task) => {
      if (task.id === id) {
        const taskXp = getTaskXp(task);
        
        const relevantDate = task.type === 'monthly' ? startOfMonth(date) : startOfDay(date);
        const dateStr = format(relevantDate, 'yyyy-MM-dd');

        const isCompleted = task.completions.includes(dateStr);
        
        let newCompletions: string[];
        if (isCompleted) {
          xpChange = -taskXp;
          newCompletions = task.completions.filter(d => d !== dateStr);
        } else {
          xpChange = taskXp;
          newCompletions = [...task.completions, dateStr];
        }

        if(!isCompleted) {
            toast({
                title: `+${taskXp} XP! ✨`,
                description: `You've completed "${task.title}". Great job!`,
            });
            if (data.userStats.xp + xpChange > 100 && data.userStats.xp <= 100) {
              toast({
                title: '🎉 Reward Yourself! 🎉',
                description: 'You have earned over 100 XP. Time for a well-deserved break!',
              });
            }
        }
        return { ...task, completions: newCompletions };
      }
      return task;
    });

    handleDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange } });
  };

  const onDelete = (id: string) => {
    let xpChange = 0;
    const taskToDelete = data.tasks.find(t => t.id === id);
    if (taskToDelete) {
        const taskXp = getTaskXp(taskToDelete);
        xpChange = -taskXp * taskToDelete.completions.length;
    }
    const newTasks = data.tasks.filter((task) => task.id !== id);
    handleDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange }});
  };

  const getTasksForDate = (date: Date): Task[] => {
      return data.tasks.filter(task => {
          switch (task.type) {
              case 'single': 
                return task.date ? isSameDay(new Date(task.date), date) : false;
              case 'recurring': 
                return true;
              case 'weekly':
                if (!task.week) return false;
                const taskWeekDate = startOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
                return isSameWeek(date, taskWeekDate, { weekStartsOn: 1 });
              case 'monthly':
                return false;
              default: 
                return false;
          }
      });
  };
  
  const allTasksInMonth = data.tasks.filter(task => {
    switch (task.type) {
        case 'monthly':
            return task.month === format(currentMonth, 'yyyy-MM');
        case 'weekly': {
            if (!task.week) return false;
            const taskWeekDate = startOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
            return isSameMonth(taskWeekDate, currentMonth);
        }
        case 'single':
            return task.date ? isSameMonth(new Date(task.date), currentMonth) : false;
        case 'recurring':
            return true;
        default:
            return false;
    }
  });

  const monthlyXp = allTasksInMonth.reduce((acc, task) => {
    const completionsForMonth = task.completions.filter(c => isSameMonth(new Date(c), currentMonth));
    if (task.type === 'monthly') {
        return acc + (completionsForMonth.length > 0 ? getTaskXp(task) : 0);
    }
    return acc + completionsForMonth.length * getTaskXp(task);
  }, 0);
  
  const monthlyTasks = data.tasks.filter(t => t.type === 'monthly' && t.month === format(currentMonth, 'yyyy-MM'));
  const totalPossibleMonthlyXp = monthlyTasks.reduce((acc, task) => acc + getTaskXp(task), 0);
  
  const tasksForCurrentDay = getTasksForDate(currentDay);
  const completedCountForDay = tasksForCurrentDay.filter(t => t.completions.includes(format(currentDay, 'yyyy-MM-dd'))).length;
  const dailyProgress = tasksForCurrentDay.length > 0 ? (completedCountForDay / tasksForCurrentDay.length) * 100 : 0;

  return (
    <AppLayout>
      <main className="p-4 md:p-8 space-y-6">
        <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>My Tasks</CardTitle>
                <CardDescription>A complete overview of your tasks.</CardDescription>
              </div>
               <div className="flex items-center gap-2 self-end md:self-center">
                    <Button variant="outline" size="icon" onClick={handlePreviousMonth}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-lg font-semibold w-36 text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </CardHeader>
            <CardContent>
                <TaskList
                    data={data}
                    onDataChange={handleDataChange}
                    currentMonth={currentMonth}
                />
            </CardContent>
        </Card>
        
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily"><CalendarDays className="w-4 h-4 mr-2"/>Daily</TabsTrigger>
            <TabsTrigger value="monthly"><ClipboardList className="w-4 h-4 mr-2"/>Monthly</TabsTrigger>
          </TabsList>
          
          <TabsContent value="daily" className="mt-6">
              <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5"/> Daily Breakdown</CardTitle>
                            <CardDescription>All your scheduled tasks for the selected day.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={handlePreviousDay}><ChevronLeft className="h-4 w-4" /></Button>
                            <span className="text-md font-semibold w-40 text-center">{format(currentDay, 'EEEE, MMM do')}</span>
                            <Button variant="outline" size="icon" onClick={handleNextDay}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Progress value={dailyProgress} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground">{Math.round(dailyProgress)}%</span>
                        </div>
                        {tasksForCurrentDay.length > 0 ? (
                            <div className="space-y-2">
                            {tasksForCurrentDay.map(task => (
                                <TaskItem
                                    key={`${task.id}-${format(currentDay, 'yyyy-MM-dd')}`}
                                    task={task}
                                    onToggle={() => onToggle(task.id, currentDay)}
                                    onDelete={() => onDelete(task.id)}
                                    isCompleted={task.completions.includes(format(startOfDay(currentDay), 'yyyy-MM-dd'))}
                                />
                            ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-10">No tasks scheduled for {format(currentDay, 'MMMM do, yyyy')}.</p>
                        )}
                    </div>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-6">
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5"/> Monthly Goals</CardTitle>
                      <CardDescription>High-level targets for {format(currentMonth, 'MMMM')}.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 text-primary font-semibold">
                            <span>Monthly XP: {monthlyXp}</span>
                            <Progress value={totalPossibleMonthlyXp > 0 ? (monthlyXp / totalPossibleMonthlyXp) * 100 : 0} className="w-48 h-2" />
                        </div>
                        <div className="space-y-2">
                            {monthlyTasks.map(task => (
                               <TaskItem
                                    key={task.id}
                                    task={task}
                                    onToggle={() => onToggle(task.id, currentMonth)}
                                    onDelete={() => onDelete(task.id)}
                                    isCompleted={task.completions.includes(format(startOfMonth(currentMonth), 'yyyy-MM-dd'))}
                               />
                            ))}
                            {monthlyTasks.length === 0 && (
                                <p className="text-center text-muted-foreground py-10">No specific monthly goals set. Add one using the form above!</p>
                            )}
                        </div>
                    </div>
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>

      </main>
    </AppLayout>
  );
}
