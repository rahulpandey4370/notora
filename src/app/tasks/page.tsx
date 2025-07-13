
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import TaskList from '@/components/notora/TaskList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Task } from '@/lib/types';

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, loading: appLoading, handleDataChange } = useApp();
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

  const tasksForMonth = data.tasks.filter(task => isSameMonth(new Date(task.date), currentMonth));
  
  const tasksByDay = tasksForMonth.reduce<Record<string, Task[]>>((acc, task) => {
    const day = format(new Date(task.date), 'yyyy-MM-dd');
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(task);
    return acc;
  }, {});

  const daysWithTasks = Object.keys(tasksByDay).sort();

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
                {daysWithTasks.length > 0 ? (
                     <Accordion type="multiple" defaultValue={daysWithTasks.map(day => `item-${day}`)} className="w-full">
                        {daysWithTasks.map(day => {
                           const date = new Date(day);
                           // Adjust for timezone offset to prevent date shifting
                           const displayDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
                           
                           return (
                             <AccordionItem value={`item-${day}`} key={day}>
                               <AccordionTrigger>
                                {format(displayDate, 'EEEE, MMMM do')}
                               </AccordionTrigger>
                               <AccordionContent>
                                 <TaskList 
                                   tasks={tasksByDay[day]} 
                                   onDataChange={handleDataChange} 
                                   data={data}
                                   selectedDate={displayDate}
                                 />
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
      </main>
    </AppLayout>
  );
}
