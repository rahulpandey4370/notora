
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
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Task } from '@/lib/types';
import TaskItem from '@/components/notora/TaskItem';

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
  
  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const getTasksForDay = (day: Date) => {
    return data.tasks.filter(task => {
        if (task.type === 'recurring') {
            return true;
        }
        if (task.type === 'single' && task.date) {
            return isSameDay(new Date(task.date), day);
        }
        return false;
    });
  };

  const tasksForMonth = data.tasks.filter(task => {
      if (task.type === 'single' && task.date) {
          return isSameMonth(new Date(task.date), currentMonth);
      }
      if(task.type === 'monthly' && task.month) {
          return task.month === format(currentMonth, 'yyyy-MM');
      }
      // Recurring tasks are considered for every month
      if (task.type === 'recurring') {
          return true;
      }
      return false;
  });

  const dailyTasks = tasksForMonth.filter(t => t.type === 'single');
  const monthlyTasks = tasksForMonth.filter(t => t.type === 'monthly' && t.month === format(currentMonth, 'yyyy-MM'));
  
  const tasksByDay = dailyTasks.reduce<Record<string, Task[]>>((acc, task) => {
    if(!task.date) return acc;
    const day = format(new Date(task.date), 'yyyy-MM-dd');
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(task);
    return acc;
  }, {});

  const daysWithTasks = Object.keys(tasksByDay).sort();
  const defaultOpenAccordion = daysWithTasks.length > 0 ? [`item-${daysWithTasks[0]}`] : [];

   const xpMap: Record<Task['priority'], number> = {
    Easy: 10,
    Medium: 25,
    Hard: 50,
  };

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
        // For recurring, we can't determine XP loss easily, so we just remove the task.
        // For others, if they were completed, deduct points.
        if (taskToDelete.completions.length > 0) {
            xpChange = -xpMap[taskToDelete.priority] * taskToDelete.completions.length;
        }
    }
    const newTasks = data.tasks.filter((task) => task.id !== id);
    handleDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange }});
  };

  return (
    <AppLayout>
      <main className="p-4 md:p-8 space-y-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Tasks</CardTitle>
               <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-semibold w-36 text-center">
                        {format(currentMonth, 'MMMM yyyy')}
                    </span>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                           <CardTitle className='flex items-center gap-2 text-xl'><ClipboardList className="h-5 w-5"/> Monthly Goals</CardTitle>
                           <CardDescription>Tasks to complete this month.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TaskList
                                tasks={monthlyTasks}
                                data={data}
                                onDataChange={handleDataChange}
                                selectedDate={currentMonth}
                                taskType="monthly"
                                currentMonth={currentMonth}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className='text-xl'>Daily Tasks</CardTitle>
                            <CardDescription>All your scheduled tasks for {format(currentMonth, 'MMMM')}.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center gap-2 mb-4">
                                <TaskList
                                    tasks={[]} // Pass empty to only show add form
                                    data={data}
                                    onDataChange={handleDataChange}
                                    selectedDate={new Date()}
                                    taskType="single"
                                />
                            </div>
                            {daysWithTasks.length > 0 ? (
                                <Accordion type="multiple" defaultValue={defaultOpenAccordion} className="w-full">
                                    {daysWithTasks.map(day => {
                                        const date = new Date(day);
                                        const displayDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
                                        const allTasksForDay = getTasksForDay(displayDate);

                                        return (
                                            <AccordionItem value={`item-${day}`} key={day}>
                                            <AccordionTrigger>
                                                {format(displayDate, 'EEEE, MMMM do')}
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                {allTasksForDay.map(task => (
                                                    <TaskItem
                                                        key={`${task.id}-${day}`}
                                                        task={task}
                                                        onToggle={() => onToggle(task.id, displayDate)}
                                                        onDelete={() => onDelete(task.id)}
                                                        isCompleted={task.completions.includes(format(displayDate, 'yyyy-MM-dd'))}
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
                </div>
            </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}
