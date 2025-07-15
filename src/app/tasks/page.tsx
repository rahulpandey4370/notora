
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import TaskList from '@/components/notora/TaskList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ClipboardList, CalendarDays } from 'lucide-react';
import { format, startOfMonth, addMonths, subMonths, isSameDay, startOfDay, addDays, subDays, isAfter, isSameMonth, endOfMonth, startOfWeek, isWithinInterval, isBefore } from 'date-fns';
import type { Task } from '@/lib/types';
import TaskItem from '@/components/notora/TaskItem';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTaskXp } from '@/lib/utils';

const XP_PENALTY: Record<Task['priority'], number> = {
  Easy: 5,
  Medium: 10,
  Hard: 15,
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
    setCurrentDay(startOfMonth(newMonth));
  };
  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setCurrentDay(startOfMonth(newMonth));
  };

  const handlePreviousDay = () => setCurrentDay(subDays(currentDay, 1));
  const handleNextDay = () => setCurrentDay(addDays(currentDay, 1));

  const { monthlyXp, totalPossibleMonthlyXp } = useMemo(() => {
    if (!data) return { monthlyXp: 0, totalPossibleMonthlyXp: 0 };

    const allTasksInMonth = data.tasks.filter(task => {
        if (task.type === 'monthly') {
            return task.month === format(currentMonth, 'yyyy-MM');
        }
        if (task.type === 'weekly' && task.week) {
            const taskWeekDate = startOfWeek(new Date(task.week.replace(/(\\d{4})-(\\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
            return isSameMonth(taskWeekDate, currentMonth);
        }
        if (task.type === 'single' && task.date) {
            return isSameMonth(new Date(task.date), currentMonth);
        }
        if (task.type === 'recurring') {
            const createdAt = new Date(task.createdAt);
            // check if the task's creation month is the same as the current month
            return isSameMonth(createdAt, currentMonth);
        }
        return false;
    });

    const xp = allTasksInMonth.reduce((acc, task) => {
        const taskXp = getTaskXp(task);
        const completionsForMonth = (task.completions || []).filter(c => isSameMonth(new Date(c), currentMonth));
        return acc + completionsForMonth.length * taskXp;
    }, 0);

    const totalXp = allTasksInMonth.reduce((acc, task) => {
        if (task.type === 'recurring') {
            const start = startOfDay(new Date(task.createdAt));
            if (!isSameMonth(start, currentMonth)) return acc;

            const end = endOfMonth(currentMonth);
            const daysInRange = Array.from({ length: end.getDate() }, (_, i) => addDays(startOfMonth(currentMonth), i));
            const applicableDays = daysInRange.filter(day => isAfter(day, start) || isSameDay(day, start)).length;
            return acc + (applicableDays * getTaskXp(task));
        }
        return acc + getTaskXp(task);
    }, 0);
    
    return { monthlyXp: xp, totalPossibleMonthlyXp: totalXp };
  }, [data, currentMonth]);


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

        const isCompleted = (task.completions || []).includes(dateStr);
        
        let newCompletions: string[];
        if (isCompleted) {
          xpChange = -taskXp;
          newCompletions = (task.completions || []).filter(d => d !== dateStr);
        } else {
          xpChange = taskXp;
          newCompletions = [...(task.completions || []), dateStr];
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
        xpChange = -(taskToDelete.completions || []).length * taskXp;
    }
    const newTasks = data.tasks.filter((task) => task.id !== id);
    handleDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange }});
  };

  const handleCarryForward = (id: string) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;

    if ((task.carryForwardCount || 0) >= 2) {
      toast({
        variant: 'destructive',
        title: 'Cannot Carry Forward',
        description: 'This task has already been carried forward twice.',
      });
      return;
    }

    const penalty = XP_PENALTY[task.priority];

    const newTasks = data.tasks.map(t => {
      if (t.id === id) {
        const originalXp = t.originalXp || getTaskXp(t);

        return {
          ...t,
          date: addDays(new Date(t.date!), 1).toISOString(),
          carryForwardCount: (t.carryForwardCount || 0) + 1,
          originalXp: originalXp,
        };
      }
      return t;
    });

    handleDataChange({ ...data, tasks: newTasks });
    toast({
      title: 'Task Carried Forward',
      description: `"${task.title}" moved to tomorrow with a ${penalty} XP penalty.`,
    });
  };

  const getTasksForDate = (date: Date): Task[] => {
      return data.tasks.filter(task => {
          switch (task.type) {
              case 'single': 
                return task.date ? isSameDay(new Date(task.date), date) : false;
              case 'recurring':
                const createdAt = new Date(task.createdAt);
                const monthEnd = endOfMonth(createdAt);
                return (isSameDay(date, createdAt) || isAfter(date, createdAt)) && (isSameDay(date, monthEnd) || isAfter(monthEnd, date));
              case 'weekly':
                if (!task.week) return false;
                const taskWeekStartDate = startOfWeek(new Date(task.week.replace(/(\\d{4})-(\\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
                return isWithinInterval(date, { start: taskWeekStartDate, end: addDays(taskWeekStartDate, 6) });
              case 'monthly':
                return false;
              default: 
                return false;
          }
      });
  };
  
  const monthlyTasks = data.tasks.filter(t => t.type === 'monthly' && t.month === format(currentMonth, 'yyyy-MM'));
  
  const tasksForCurrentDay = getTasksForDate(currentDay);
  const completedCountForDay = tasksForCurrentDay.filter(t => (t.completions || []).includes(format(currentDay, 'yyyy-MM-dd'))).length;
  const dailyProgress = tasksForCurrentDay.length > 0 ? (completedCountForDay / tasksForCurrentDay.length) * 100 : 0;
  
  const isPastDay = isBefore(currentDay, startOfDay(new Date()));

  return (
    <AppLayout>
      <main className="p-4 md:p-8 space-y-6">
        <Card className="dark:neon-border">
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
              <Card className="dark:neon-border">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5"/> Daily Breakdown</CardTitle>
                            <CardDescription>All your scheduled tasks for the selected day.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center">
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
                            {tasksForCurrentDay.map(task => {
                                const isCompleted = (task.completions || []).includes(format(startOfDay(currentDay), 'yyyy-MM-dd'));
                                const canCarryForward = isPastDay && !isCompleted && task.type === 'single';

                                return (
                                    <TaskItem
                                        key={`${task.id}-${format(currentDay, 'yyyy-MM-dd')}`}
                                        task={task}
                                        onToggle={() => onToggle(task.id, currentDay)}
                                        onDelete={() => onDelete(task.id)}
                                        isCompleted={isCompleted}
                                        onCarryForward={canCarryForward ? () => handleCarryForward(task.id) : undefined}
                                    />
                                );
                            })}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-10">No tasks scheduled for {format(currentDay, 'MMMM do, yyyy')}.</p>
                        )}
                    </div>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-6">
              <Card className="dark:neon-border">
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
                                    isCompleted={(task.completions || []).includes(format(startOfMonth(currentMonth), 'yyyy-MM-dd'))}
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
