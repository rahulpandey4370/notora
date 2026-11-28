
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { pageGate } from '@/lib/page-gate';
import LoadFailed from '@/components/notora/LoadFailed';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import TaskList from '@/components/notora/TaskList';
import SmartEmptyState from '@/components/notora/SmartEmptyState';
import TaskTemplates from '@/components/notora/TaskTemplates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ClipboardList, CalendarDays } from 'lucide-react';
import { format, startOfMonth, addMonths, subMonths, isSameDay, startOfDay, addDays, subDays, isAfter, isSameMonth, endOfMonth, startOfWeek, isWithinInterval, isBefore, isYesterday, setHours, setMinutes, setSeconds, endOfDay , parseISO} from 'date-fns';
import { toYmd } from '@/lib/date-utils';
import type { Task } from '@/lib/types';
import TaskItem, { crossesReward, deleteWithUndo, editSingleTask } from '@/components/notora/TaskItem';
import { weekStart } from '@/lib/week';
import { doneOn, monthXp, overdueOn, tasksOn, toggleOn, OVERDUE_GRACE_HOUR } from '@/lib/task-status';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTaskXp } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { deleteFrom, editFrom, isRepeating, monthlyShowsIn, recurringShowsOn } from '@/lib/tasks';
import RepeatingTasks from '@/components/notora/RepeatingTasks';
import { useShowcase } from '@/contexts/showcase-context';
import { cn } from '@/lib/utils';

const XP_PENALTY: Record<Task['priority'], number> = {
  Easy: 5,
  Medium: 10,
  Hard: 15,
};

interface TasksPageProps {
  showcase?: boolean;
}

function useTasksPageData(isShowcase: boolean) {
  if (isShowcase) {
    const showcaseData = useShowcase();
    return {
      data: showcaseData.data,
      loading: !showcaseData.data,
      loadFailed: false,
      retryLoad: undefined,
      user: showcaseData.demoUser,
      handleDataChange: showcaseData.handleDataChange,
      toast: showcaseData.toast,
    };
  }

  const appData = useApp();
  const auth = useAuth();
  return {
    data: appData.data,
    loading: auth.loading || appData.loading,
    loadFailed: appData.loadFailed,
    retryLoad: appData.retryLoad,
    user: auth.user,
    handleDataChange: appData.handleDataChange,
    toast: appData.toast,
  };
}

export default function TasksPage({ showcase = false }: TasksPageProps) {
  const router = useRouter();
  const { data, loading, user, handleDataChange, toast, loadFailed, retryLoad } = useTasksPageData(showcase);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentDay, setCurrentDay] = useState(new Date());

  useEffect(() => {
    if (!showcase && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, showcase]);
  
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
    const m = monthXp(data.tasks, currentMonth); // lib/task-status
    return { monthlyXp: m.earned, totalPossibleMonthlyXp: m.possible };
  }, [data, currentMonth]);

  // Undo-delete restores into the data as it is when Undo is clicked, not as it was at delete.
  const latest = useRef(data!);
  if (data) latest.current = data;


  // One named state for the page (lib/page-gate). 'failed' used to be a skeleton forever; the guard below keeps the types narrow.
  if (pageGate({ loading, user: user, data, loadFailed }).kind === 'failed') {
    return <AppLayout data={data}><LoadFailed onRetry={retryLoad} /></AppLayout>;
  }

  if (loading || !data || !user) {
    return (
      <AppLayout data={data}>
        <div className="p-4 md:p-8 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }
  
  const showNotification = (title: string, options: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          ...options,
          icon: '/notora.png',
          badge: '/notora.png',
        });
      });
    }
  };

  // What a tick does (and its XP) is decided in lib/task-status: a weekly task is done for its whole week.
  const onToggle = (id: string, date: Date) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    const { task: next, xpDelta, done } = toggleOn(task, format(date, 'yyyy-MM-dd'));
    if (done) {
      const message = `You've completed "${task.title}". Great job!`;
      toast({ title: `+${xpDelta} XP! ✨`, description: message });
      showNotification(`+${xpDelta} XP! ✨`, { body: message });
      if (crossesReward(data.userStats.xp, data.userStats.xp + xpDelta)) {
        const rewardMessage = 'You have earned over 100 XP. Time for a well-deserved break!';
        toast({ title: '🎉 Reward Yourself! 🎉', description: rewardMessage });
        showNotification('🎉 Reward Yourself! 🎉', { body: rewardMessage });
      }
    }
    handleDataChange({ ...data, tasks: data.tasks.map(t => (t.id === id ? next : t)), userStats: { xp: data.userStats.xp + xpDelta } });
  };

  const onDelete = (id: string) => deleteWithUndo(id, latest, handleDataChange, toast);
  const onEdit = (id: string, edit: { title: string; priority: Task['priority']; date?: string }) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    const { task: next, xpDelta } = editSingleTask(task, edit);
    handleDataChange({ ...data, tasks: data.tasks.map(t => (t.id === id ? next : t)), userStats: { ...data.userStats, xp: data.userStats.xp + xpDelta } });
  };

  /** A repeating task: keep it on earlier days, drop it after today. */
  /** Repeating tasks, from today on: earlier days keep the task and their ticks. */
  const onDeleteFromToday = (id: string) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    const { task: kept, removed } = deleteFrom(task, format(new Date(), 'yyyy-MM-dd'));
    handleDataChange({ ...data, tasks: kept ? data.tasks.map(t => (t.id === id ? kept : t)) : data.tasks.filter(t => t.id !== id), userStats: { xp: data.userStats.xp - removed * getTaskXp(task) } });
  };
  const onEditFromToday = (id: string, edit: { title: string; priority: Task['priority'] }) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    const parts = editFrom(task, edit, format(new Date(), 'yyyy-MM-dd'), uuidv4);
    handleDataChange({ ...data, tasks: data.tasks.flatMap(t => (t.id === id ? parts : [t])) });
  };

  const handleCarryForward = (id: string) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;

    if ((task.carryForwardCount || 0) >= 2) {
      if (toast) {
        toast({
          variant: 'destructive',
          title: 'Cannot Carry Forward',
          description: 'This task has already been carried forward twice.',
        });
      }
      return;
    }

    const penalty = XP_PENALTY[task.priority];

    const newTasks = data.tasks.map(t => {
      if (t.id === id) {
        const originalXp = t.originalXp || getTaskXp(t);

        return {
          ...t,
          date: toYmd(addDays(parseISO(t.date!), 1)),
          carryForwardCount: (t.carryForwardCount || 0) + 1,
          originalXp: originalXp,
        };
      }
      return t;
    });

    handleDataChange({ ...data, tasks: newTasks });
    if(toast) {
        toast({
        title: 'Task Carried Forward',
        description: `"${task.title}" moved to tomorrow with a ${penalty} XP penalty.`,
        });
    }
  };

  const getTasksForDate = (date: Date): Task[] => tasksOn(data.tasks, format(date, 'yyyy-MM-dd')); // lib/task-status

  const monthlyTasks = data.tasks.filter(t => monthlyShowsIn(t, format(currentMonth, 'yyyy-MM')));
  
  const tasksForCurrentDay = getTasksForDate(currentDay);
  const completedCountForDay = tasksForCurrentDay.filter(t => doneOn(t, format(currentDay, 'yyyy-MM-dd'))).length;
  const dailyProgress = tasksForCurrentDay.length > 0 ? (completedCountForDay / tasksForCurrentDay.length) * 100 : 0;

  return (
    <AppLayout data={data}>
      <main className="p-4 md:p-8 space-y-6">
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily"><CalendarDays className="w-4 h-4 mr-2"/>Daily</TabsTrigger>
            <TabsTrigger value="monthly"><ClipboardList className="w-4 h-4 mr-2"/>Monthly</TabsTrigger>
          </TabsList>
          
          <TabsContent value="daily" className="mt-6">
              <Card className="dark:neon-tasks">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5"/> Daily Breakdown</CardTitle>
                            <CardDescription>All your scheduled tasks for the selected day.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center">
                            <Button variant="outline" size="icon" onClick={handlePreviousDay} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></Button>
                            <span className="text-md font-semibold w-40 text-center">{format(currentDay, 'EEEE, MMM do')}</span>
                            <Button variant="outline" size="icon" onClick={handleNextDay} aria-label="Next day"><ChevronRight className="h-4 w-4" /></Button>
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
                                const dayStr = format(currentDay, 'yyyy-MM-dd');
                                const isCompleted = doneOn(task, dayStr);
                                // Yesterday is not overdue until 11 PM today (OVERDUE_GRACE_HOUR, lib/task-status).
                                const isPastDue = overdueOn(dayStr, new Date(), OVERDUE_GRACE_HOUR);

                                const canCarryForward = task.type === 'single' && isPastDue && !isCompleted && (task.carryForwardCount || 0) < 2;
          
                                return (
                                    <TaskItem
                                        key={`${task.id}-${format(currentDay, 'yyyy-MM-dd')}`}
                                        task={task}
                                        onToggle={() => onToggle(task.id, currentDay)}
                                        onDelete={() => onDelete(task.id)}
                                        onDeleteFromToday={task.type === 'recurring' && isRepeating(task) ? () => onDeleteFromToday(task.id) : undefined}
                                        onEditFromToday={task.type === 'recurring' && isRepeating(task) ? e => onEditFromToday(task.id, e) : undefined}
                                        onEdit={task.type === 'single' ? e => onEdit(task.id, e) : undefined}
                                        isCompleted={isCompleted}
                                        onCarryForward={canCarryForward ? () => handleCarryForward(task.id) : undefined}
                                        isPastDue={isPastDue && !isCompleted}
                                        className={cn((isPastDue && !isCompleted) ? "bg-muted/50" : "")}
                                    />
                                );
                            })}
                            </div>
                        ) : (
                            <SmartEmptyState surface="tasks" data={data} message={`No tasks scheduled for ${format(currentDay, 'MMMM do, yyyy')}.`} />
                        )}
                    </div>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-6">
              <Card className="dark:neon-tasks">
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
                                    onDeleteFromToday={isRepeating(task) ? () => onDeleteFromToday(task.id) : undefined}
                                    onEditFromToday={isRepeating(task) ? e => onEditFromToday(task.id, e) : undefined}
                                    isCompleted={doneOn(task, format(currentMonth, 'yyyy-MM-dd'))}
                               />
                            ))}
                            {monthlyTasks.length === 0 && (
                                <p className="text-center text-muted-foreground py-10">No specific monthly goals set. Add one using the form below!</p>
                            )}
                        </div>
                    </div>
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>

        <Card className="dark:neon-tasks">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>My Tasks</CardTitle>
                <CardDescription>A complete overview of your tasks.</CardDescription>
              </div>
               <div className="flex items-center gap-2 self-end md:self-center">
                    <Button variant="outline" size="icon" onClick={handlePreviousMonth} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-lg font-semibold w-36 text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                    <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
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
        
        <TaskTemplates
            data={data}
            onDataChange={handleDataChange}
            currentMonth={currentMonth}
            toast={toast}
        />
        <RepeatingTasks data={data} onDataChange={handleDataChange} />

      </main>
    </AppLayout>
  );
}
