'use client';
import SmartEmptyState from './SmartEmptyState';

import type { User, AppData, Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useMemo, useRef } from 'react';
import { Calendar, Flame, TrendingUp } from 'lucide-react';
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, addDays, isSameMonth, isAfter, startOfDay, isBefore, setHours, setMinutes, setSeconds, getDay, getDaysInMonth, endOfDay , parseISO} from 'date-fns';
import { toYmd } from '@/lib/date-utils';
import { getTaskXp } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { deleteFrom, editFrom, isRepeating, monthlyShowsIn, recurringShowsOn } from '@/lib/tasks';
import { doneOn, monthXp, overdueOn, taskDay, tasksOn, toggleOn, weekXp } from '@/lib/task-status';
import { useApp } from '@/hooks/use-app';
import { PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart, Label } from "recharts"
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart"
import TaskList from './TaskList';
import TaskItem, { crossesReward, deleteWithUndo, editSingleTask } from './TaskItem';
import { weekStart } from '@/lib/week';
import { motion } from 'framer-motion';
import { Progress } from '../ui/progress';
import CalendarAnalysis from './CalendarAnalysis';

const weeklyChartConfig = {
  xp: {
    label: "XP",
  },
  weekly: {
    label: "Weekly XP",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

const monthlyChartConfig = {
  xp: {
    label: "XP",
  },
  monthly: {
    label: "Monthly XP",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

const XP_PENALTY: Record<Task['priority'], number> = {
  Easy: 5,
  Medium: 10,
  Hard: 15,
};

interface DashboardProps {
  user: User;
  data: AppData;
  onDataChange: (data: AppData) => void;
}


export default function Dashboard({ user, data, onDataChange }: DashboardProps) {
  const { tasks } = data;
  const { toast } = useApp();
  // One Date per day, so the memos below only recompute when the data or the day changes.
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const today = useMemo(() => parseISO(todayStr), [todayStr]);
  const latest = useRef(data);
  latest.current = data;

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
          date: toYmd(addDays(parseISO(t.date!), 1)),
          carryForwardCount: (t.carryForwardCount || 0) + 1,
          originalXp: originalXp,
        };
      }
      return t;
    });

    onDataChange({ ...data, tasks: newTasks });
    toast({
      title: 'Task Carried Forward',
      description: `"${task.title}" moved to tomorrow with a ${penalty} XP penalty.`,
    });
  };

  // What a tick does (and its XP) is decided in lib/task-status: a weekly task is done for its whole week.
  const onToggle = (id: string, date: Date) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    const { task: next, xpDelta, done } = toggleOn(task, format(date, 'yyyy-MM-dd'));
    if (done) {
      toast({ title: `+${xpDelta} XP! ✨`, description: `You've completed "${task.title}". Great job!` });
      if (crossesReward(data.userStats.xp, data.userStats.xp + xpDelta)) {
        toast({ title: '🎉 Reward Yourself! 🎉', description: 'You have earned over 100 XP. Time for a well-deserved break!' });
      }
    }
    onDataChange({ ...data, tasks: data.tasks.map(t => (t.id === id ? next : t)), userStats: { xp: data.userStats.xp + xpDelta } });
  };

  const onDelete = (id: string) => deleteWithUndo(id, latest, onDataChange, toast);
  const onEdit = (id: string, edit: { title: string; priority: Task['priority']; date?: string }) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    const { task: next, xpDelta } = editSingleTask(task, edit);
    onDataChange({ ...data, tasks: data.tasks.map(t => (t.id === id ? next : t)), userStats: { ...data.userStats, xp: data.userStats.xp + xpDelta } });
  };

  /** Repeating tasks, from today on: earlier days keep the task and their ticks. */
  const onDeleteFromToday = (id: string) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    const { task: kept, removed } = deleteFrom(task, format(new Date(), 'yyyy-MM-dd'));
    onDataChange({ ...data, tasks: kept ? data.tasks.map(t => (t.id === id ? kept : t)) : data.tasks.filter(t => t.id !== id), userStats: { xp: data.userStats.xp - removed * getTaskXp(task) } });
  };
  const onEditFromToday = (id: string, edit: { title: string; priority: Task['priority'] }) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    const parts = editFrom(task, edit, format(new Date(), 'yyyy-MM-dd'), uuidv4);
    onDataChange({ ...data, tasks: data.tasks.flatMap(t => (t.id === id ? parts : [t])) });
  };
  
  const allTodaysTasks = useMemo(() => tasksOn(tasks, todayStr).sort((a, b) => {
    const aDate = a.date ? parseISO(a.date) : new Date(a.createdAt);
    const bDate = b.date ? parseISO(b.date) : new Date(b.createdAt);
    return aDate.getTime() - bDate.getTime();
  }), [tasks, todayStr]);

  /** Past single tasks not ticked on their day: tick late (counts on that day) or carry forward, as on the Tasks page. */
  // No grace hour here: yesterday's tasks are listed as overdue from midnight (the Tasks page waits until 11 PM;
  // see OVERDUE_GRACE_HOUR in lib/task-status, an open decision).
  const overdueTasks = useMemo(() => tasks.filter(t => t.type === 'single' && !!t.date && overdueOn(taskDay(t.date), today) && !doneOn(t, taskDay(t.date))), [tasks, today]);

  // Week and month totals: lib/task-status (the same code the Tasks page uses for its month ring).
  const { weeklyXp, totalWeeklyXp } = useMemo(() => { const w = weekXp(tasks, today); return { weeklyXp: w.earned, totalWeeklyXp: w.possible }; }, [tasks, today]);
  const { monthlyXp, totalPossibleMonthlyXp } = useMemo(() => { const m = monthXp(tasks, today); return { monthlyXp: m.earned, totalPossibleMonthlyXp: m.possible }; }, [tasks, today]);

  const { completedTodayCount, todaysTotalXp, todaysAchievedXp } = useMemo(() => {
    const completedTasks = allTodaysTasks.filter(t => doneOn(t, todayStr));
    const completedCount = completedTasks.length;
    const totalXp = allTodaysTasks.reduce((acc, t) => acc + getTaskXp(t), 0);
    const achievedXp = completedTasks.reduce((acc, t) => acc + getTaskXp(t), 0);
    return { completedTodayCount: completedCount, todaysTotalXp: totalXp, todaysAchievedXp: achievedXp };
  }, [allTodaysTasks, todayStr]);
  
  const animationVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5
      }
    }),
  };

  const weeklyChartData = [{
    xp: weeklyXp,
    total: totalWeeklyXp,
    fill: "var(--color-weekly)"
  }];

  const monthlyChartData = [{
    xp: monthlyXp,
    total: totalPossibleMonthlyXp,
    fill: "var(--color-monthly)"
  }];


  return (
    <div className="p-4 md:p-8 space-y-6">
        <motion.div variants={animationVariants} initial="hidden" animate="visible" custom={0}>
          <Card className="nb-border rounded-lg shadow-none dark:neon-dashboard">
            <CardHeader className='pb-2'>
              <CardTitle className='text-center'>Progress Tracker</CardTitle>
            </CardHeader>
            <CardContent>
                <div className='flex items-center justify-between text-sm font-semibold mb-1'>
                    <span className='flex items-center gap-1.5'><Flame className='w-4 h-4 text-orange-500' /> Your XP</span>
                    <span>{todaysAchievedXp} / {todaysTotalXp} XP</span>
                </div>
                 <div className="w-full bg-muted rounded-full h-4 nb-border p-0.5">
                    <motion.div
                        className="bg-gradient-to-r from-green-400 to-teal-400 h-full rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${todaysTotalXp > 0 ? (todaysAchievedXp / todaysTotalXp) * 100 : 0}%`}}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                    />
                </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            className="lg:col-span-2 space-y-6"
            variants={animationVariants}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            <motion.div whileHover={{ y: -5, transition: { duration: 0.2 } }}>
              <Card className="nb-border rounded-lg shadow-none dark:neon-tasks">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/> Today's Focus</CardTitle>
                      <CardDescription>Tasks for today. ({completedTodayCount}/{allTodaysTasks.length} completed)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <TaskList data={data} onDataChange={onDataChange} currentMonth={today} />
                      {overdueTasks.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-destructive">Overdue ({overdueTasks.length})</h3>
                          {overdueTasks.map(task => (
                            <TaskItem
                                key={`${task.id}-${task.date}`}
                                task={task}
                                onToggle={() => onToggle(task.id, parseISO(task.date!))}
                                onDelete={() => onDelete(task.id)}
                                onEdit={e => onEdit(task.id, e)}
                                isCompleted={false}
                                isPastDue
                                onCarryForward={(task.carryForwardCount || 0) < 2 ? () => handleCarryForward(task.id) : undefined}
                            />
                          ))}
                        </div>
                      )}
                      <div className="pt-4 space-y-2">
                          {allTodaysTasks.length > 0 ? (
                          allTodaysTasks.map(task => {
                              const todayStart = startOfDay(today);
                              let taskDate, isCompleted;
                              
                              if (task.type === 'single' && task.date) taskDate = startOfDay(parseISO(task.date));
                              else taskDate = todayStart;
                              isCompleted = doneOn(task, format(taskDate, 'yyyy-MM-dd'));

                              return (
                                <TaskItem
                                    key={`${task.id}-${format(taskDate, 'yyyy-MM-dd')}`}
                                    task={task}
                                    onToggle={() => onToggle(task.id, taskDate)}
                                    onDelete={() => onDelete(task.id)}
                                    onDeleteFromToday={task.type === 'recurring' && isRepeating(task) ? () => onDeleteFromToday(task.id) : undefined}
                                        onEditFromToday={task.type === 'recurring' && isRepeating(task) ? e => onEditFromToday(task.id, e) : undefined}
                                    onEdit={task.type === 'single' ? e => onEdit(task.id, e) : undefined}
                                    isCompleted={isCompleted}
                                />
                              );
                          })
                          ) : (
                          <SmartEmptyState surface="dashboard" data={data} message="No tasks scheduled for today." />
                          )}
                      </div>
                  </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <div className="space-y-6">
             <motion.div
                variants={animationVariants}
                initial="hidden"
                animate="visible"
                custom={2}
            >
              <motion.div whileHover={{ y: -5, transition: { duration: 0.2 } }}>
                <Card className="flex flex-col nb-border rounded-lg shadow-none dark:neon-dashboard">
                    <CardHeader className="items-center pb-0">
                        <CardTitle>Weekly Progress</CardTitle>
                        <CardDescription>{format(startOfWeek(today, { weekStartsOn: 1 }), "MMM d")} - {format(endOfWeek(today, { weekStartsOn: 1 }), "MMM d")}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                      <ChartContainer
                          config={weeklyChartConfig}
                          className="mx-auto aspect-square max-h-[250px]"
                      >
                          <RadialBarChart
                            data={weeklyChartData}
                            startAngle={0}
                            endAngle={totalWeeklyXp > 0 ? (weeklyXp / totalWeeklyXp) * 360 : 0}
                            innerRadius={80}
                            outerRadius={110}
                          >
                            <PolarGrid
                              gridType="circle"
                              radialLines={false}
                              stroke="none"
                              className="first:fill-muted last:fill-background"
                              polarRadius={[86, 74]}
                            />
                            <RadialBar dataKey="xp" background cornerRadius={10} />
                            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                              <Label
                                content={({ viewBox }) => {
                                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                    return (
                                      <text
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                      >
                                        <tspan
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                          className="fill-foreground text-4xl font-bold"
                                        >
                                          {weeklyXp.toLocaleString()}
                                        </tspan>
                                        <tspan
                                          x={viewBox.cx}
                                          y={(viewBox.cy || 0) + 24}
                                          className="fill-muted-foreground"
                                        >
                                          Weekly XP
                                        </tspan>
                                      </text>
                                    )
                                  }
                                }}
                              />
                            </PolarRadiusAxis>
                          </RadialBarChart>
                        </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col gap-2 text-sm">
                       <div className="flex items-center gap-2 font-medium leading-none">
                          {totalWeeklyXp > 0 ? Math.round((weeklyXp / totalWeeklyXp) * 100) : 0}% of this week's XP earned {weeklyXp > 0 && <TrendingUp className="h-4 w-4" aria-hidden />}
                      </div>
                      <div className="text-muted-foreground leading-none text-center">
                        You've earned {weeklyXp} of {totalWeeklyXp} possible XP this week.
                      </div>
                    </CardFooter>
                </Card>
              </motion.div>
            </motion.div>

            <motion.div
                variants={animationVariants}
                initial="hidden"
                animate="visible"
                custom={3}
            >
              <motion.div whileHover={{ y: -5, transition: { duration: 0.2 } }}>
                <Card className="flex flex-col nb-border rounded-lg shadow-none dark:neon-dashboard">
                    <CardHeader className="items-center pb-0">
                        <CardTitle>Monthly Goal</CardTitle>
                        <CardDescription>{format(today, 'MMMM yyyy')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                      <ChartContainer
                          config={monthlyChartConfig}
                          className="mx-auto aspect-square max-h-[250px]"
                      >
                          <RadialBarChart
                            data={monthlyChartData}
                            startAngle={0}
                            endAngle={totalPossibleMonthlyXp > 0 ? (monthlyXp / totalPossibleMonthlyXp) * 360 : 0}
                            innerRadius={80}
                            outerRadius={110}
                          >
                            <PolarGrid
                              gridType="circle"
                              radialLines={false}
                              stroke="none"
                              className="first:fill-muted last:fill-background"
                              polarRadius={[86, 74]}
                            />
                            <RadialBar dataKey="xp" background cornerRadius={10} fill="var(--color-monthly)" />
                            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                              <Label
                                content={({ viewBox }) => {
                                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                    return (
                                      <text
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                      >
                                        <tspan
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                          className="fill-foreground text-4xl font-bold"
                                        >
                                          {monthlyXp.toLocaleString()}
                                        </tspan>
                                        <tspan
                                          x={viewBox.cx}
                                          y={(viewBox.cy || 0) + 24}
                                          className="fill-muted-foreground"
                                        >
                                          Monthly XP
                                        </tspan>
                                      </text>
                                    )
                                  }
                                }}
                              />
                            </PolarRadiusAxis>
                          </RadialBarChart>
                        </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col gap-2 text-sm">
                      <div className="flex items-center gap-2 font-medium leading-none">
                        {totalPossibleMonthlyXp > 0 ? Math.round((monthlyXp / totalPossibleMonthlyXp) * 100) : 0}% of this month's XP earned {monthlyXp > 0 && <TrendingUp className="h-4 w-4" aria-hidden />}
                      </div>
                      <div className="text-muted-foreground leading-none text-center">
                        You've earned {monthlyXp} of {totalPossibleMonthlyXp} possible XP this month.
                      </div>
                    </CardFooter>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </div>
        <motion.div variants={animationVariants} initial="hidden" animate="visible" custom={4}>
            <CalendarAnalysis data={data} />
        </motion.div>
    </div>
  );
}
