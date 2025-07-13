
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
import { ChevronLeft, ChevronRight, ClipboardList, Calendar, CalendarCheck, CalendarDays } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek, eachWeekOfInterval, getWeek, isSameWeek } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Task } from '@/lib/types';
import TaskItem from '@/components/notora/TaskItem';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const xpMap: Record<Task['priority'], number> = {
    Easy: 10,
    Medium: 25,
    Hard: 50,
};

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, loading: appLoading, handleDataChange, toast } = useApp();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

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
  
  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const onToggle = (id: string, date: Date) => {
    let xpChange = 0;
    const newTasks = data.tasks.map((task) => {
      if (task.id === id) {
        xpChange = xpMap[task.priority];
        const dateStr = format(date, 'yyyy-MM-dd');
        const isCompleted = task.completions.includes(dateStr);
        
        let newCompletions: string[];
        if (isCompleted) {
          xpChange = -xpChange;
          newCompletions = task.completions.filter(d => d !== dateStr);
        } else {
          newCompletions = [...task.completions, dateStr];
        }

        if(!isCompleted) {
            toast({
                title: `+${xpMap[task.priority]} XP! ✨`,
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
        xpChange = -xpMap[taskToDelete.priority] * taskToDelete.completions.length;
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
                // Monthly tasks should not appear in daily breakdown
                return false; 
              default: 
                return false;
          }
      });
  };

  // Monthly tasks
  const monthlyTasks = data.tasks.filter(t => t.type === 'monthly' && t.month === format(currentMonth, 'yyyy-MM'));
  const allTasksInMonth = eachDayOfInterval({start: startOfMonth(currentMonth), end: endOfMonth(currentMonth)}).flatMap(d => getTasksForDate(d));
  const completedTasksInMonth = allTasksInMonth.filter(t => t.completions.some(c => isSameMonth(new Date(c), currentMonth)));
  const monthlyXp = completedTasksInMonth.reduce((acc, task) => acc + xpMap[task.priority], 0);
  const totalPossibleMonthlyXp = allTasksInMonth.length * xpMap['Hard']; // Simplified denominator
  
  // Weekly tasks
  const weeksInMonth = eachWeekOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }, { weekStartsOn: 1 });
  
  // Daily tasks
  const daysInMonthWithTasks = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
      .map(day => ({ day, tasks: getTasksForDate(day) }))
      .filter(d => d.tasks.length > 0);
  const defaultOpenAccordion = daysInMonthWithTasks.length > 0 ? [`item-${format(daysInMonthWithTasks[0].day, 'yyyy-MM-dd')}`] : [];

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily"><CalendarDays className="w-4 h-4 mr-2"/>Daily</TabsTrigger>
            <TabsTrigger value="weekly"><Calendar className="w-4 h-4 mr-2"/>Weekly</TabsTrigger>
            <TabsTrigger value="monthly"><ClipboardList className="w-4 h-4 mr-2"/>Monthly</TabsTrigger>
          </TabsList>
          
          <TabsContent value="daily" className="mt-6">
              <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5"/> Daily Breakdown</CardTitle>
                    <CardDescription>All your scheduled tasks for {format(currentMonth, 'MMMM')}.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {daysInMonthWithTasks.length > 0 ? (
                        <Accordion type="multiple" defaultValue={defaultOpenAccordion} className="w-full">
                            {daysInMonthWithTasks.map(({day, tasks}) => {
                                const completedCount = tasks.filter(t => t.completions.includes(format(day, 'yyyy-MM-dd'))).length;
                                const dailyProgress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
                                
                                return (
                                    <AccordionItem value={`item-${format(day, 'yyyy-MM-dd')}`} key={format(day, 'yyyy-MM-dd')}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between w-full items-center pr-4">
                                            <span>{format(day, 'EEEE, MMMM do')}</span>
                                            <div className="flex items-center gap-2 w-24">
                                                <Progress value={dailyProgress} className="h-2 flex-1" />
                                                <span className="text-xs text-muted-foreground">{Math.round(dailyProgress)}%</span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        {tasks.map(task => (
                                            <TaskItem
                                                key={`${task.id}-${format(day, 'yyyy-MM-dd')}`}
                                                task={task}
                                                onToggle={() => onToggle(task.id, day)}
                                                onDelete={() => onDelete(task.id)}
                                                isCompleted={task.completions.includes(format(day, 'yyyy-MM-dd'))}
                                            />
                                        ))}
                                    </AccordionContent>
                                    </AccordionItem>
                                )
                            })}
                        </Accordion>
                    ) : (
                        <p className="text-center text-muted-foreground py-10">No tasks scheduled for {format(currentMonth, 'MMMM yyyy')}.</p>
                    )}
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="weekly" className="mt-6">
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/>Weekly Overview</CardTitle>
                      <CardDescription>Your weekly goals for {format(currentMonth, 'MMMM')}.</CardDescription>
                  </CardHeader>
                  <CardContent>
                     {weeksInMonth.map((weekStart) => {
                         const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                         const tasksForWeek = data.tasks.filter(t => {
                             if(t.type === 'weekly' && t.week === `${format(weekStart, 'yyyy')}-${getWeek(weekStart)}`) return true;
                             if(t.type === 'single' && t.date) {
                                 const taskDate = new Date(t.date);
                                 return taskDate >= weekStart && taskDate <= weekEnd;
                             }
                             if(t.type === 'recurring') return true;
                             return false;
                         });
                         const completionsForWeek = tasksForWeek.flatMap(t => t.completions.filter(c => {
                             const compDate = new Date(c);
                             return compDate >= weekStart && compDate <= weekEnd;
                         }));
                         const weeklyXp = tasksForWeek.filter(t => completionsForWeek.some(c => t.completions.includes(c))).reduce((acc, task) => acc + xpMap[task.priority], 0);

                         return (
                            <Accordion type="single" collapsible key={format(weekStart, 'yyyy-MM-dd')}>
                                <AccordionItem value={`week-${getWeek(weekStart)}`}>
                                <AccordionTrigger>Week {getWeek(weekStart)} ({format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')})</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-2">
                                            <span>Weekly XP: {weeklyXp}</span>
                                            <Progress value={(weeklyXp / (tasksForWeek.length * xpMap['Hard'] || 1)) * 100} className="w-32 h-2" />
                                        </div>
                                        {tasksForWeek.map(task => (
                                           <div key={task.id} className="p-2 rounded-md bg-secondary/50 text-sm">{task.title}</div>
                                        ))}
                                        {tasksForWeek.length === 0 && <p className="text-muted-foreground text-sm">No tasks for this week.</p>}
                                    </div>
                                </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                         )
                     })}
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
                                    isCompleted={task.completions.includes(format(currentMonth, 'yyyy-MM-dd'))}
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
