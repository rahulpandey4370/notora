
'use client';

import type { User, AppData, Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useMemo } from 'react';
import { Calendar, Flame, TrendingUp } from 'lucide-react';
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, addDays, isSameMonth, isAfter, startOfDay, isBefore, setHours, setMinutes, setSeconds, getDay, getDaysInMonth, endOfDay } from 'date-fns';
import { getTaskXp } from '@/lib/utils';
import { useApp } from '@/hooks/use-app';
import { PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart, Label } from "recharts"
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart"
import TaskList from './TaskList';
import TaskItem from './TaskItem';
import { motion } from 'framer-motion';
import { Progress } from '../ui/progress';

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
  const today = new Date();

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

    onDataChange({ ...data, tasks: newTasks });
    toast({
      title: 'Task Carried Forward',
      description: `"${task.title}" moved to tomorrow with a ${penalty} XP penalty.`,
    });
  };

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

    onDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange } });
  };

  const onDelete = (id: string) => {
    let xpChange = 0;
    const taskToDelete = data.tasks.find(t => t.id === id);
    if (taskToDelete) {
        const taskXp = getTaskXp(taskToDelete);
        xpChange = -((taskToDelete.completions || []).length * taskXp);
    }
    const newTasks = data.tasks.filter((task) => task.id !== id);
    onDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange }});
  };
  
  const allTodaysTasks = useMemo(() => {
    const todayStart = startOfDay(today);
    return tasks.filter(task => {
        
        if (task.type === 'single' && task.date) {
             const taskDate = startOfDay(new Date(task.date));
             return isSameDay(taskDate, todayStart);
        }
        
        if (task.type === 'recurring') {
            const createdAt = new Date(task.createdAt);
            // Show if date is in the same month as creation and on or after creation day
            return isSameMonth(today, createdAt) && (isSameDay(today, createdAt) || isAfter(today, createdAt));
        }

        if (task.type === 'weekly' && task.week) {
             const taskWeekDate = startOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
             return isWithinInterval(todayStart, { start: taskWeekDate, end: endOfWeek(taskWeekDate, { weekStartsOn: 1 }) });
        }
        return false;
    }).sort((a,b) => {
        const aDate = a.date ? new Date(a.date) : new Date(a.createdAt);
        const bDate = b.date ? new Date(b.date) : new Date(b.createdAt);
        return aDate.getTime() - bDate.getTime();
    });
  }, [tasks, today]);

  const { weeklyXp, totalWeeklyXp } = useMemo(() => {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    
    let achieved = 0;
    let total = 0;

    tasks.forEach(task => {
        const taskXpValue = getTaskXp(task);
        
        if (task.type === 'weekly' && task.week) {
            const taskWeekDate = startOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
            if (isSameDay(taskWeekDate, weekStart)) {
                total += taskXpValue;
                 if ((task.completions || []).some(c => isWithinInterval(new Date(c), { start: weekStart, end: weekEnd }))) {
                    achieved += taskXpValue;
                }
            }
        } else if (task.type === 'recurring') {
             const taskStartDate = startOfDay(new Date(task.createdAt));
             // Iterate through each day of the current week
             for (let i = 0; i < 7; i++) {
                const dayInWeek = addDays(weekStart, i);
                // Check if the day is within the task's active month and on or after its creation.
                if (isSameMonth(dayInWeek, taskStartDate) && (isAfter(dayInWeek, taskStartDate) || isSameDay(dayInWeek, taskStartDate))) {
                    total += taskXpValue;
                    if ((task.completions || []).includes(format(dayInWeek, 'yyyy-MM-dd'))) {
                       achieved += taskXpValue;
                    }
                }
            }
        } else if (task.type === 'single' && task.date) {
            const taskDate = startOfDay(new Date(task.date));
            if (isWithinInterval(taskDate, { start: weekStart, end: weekEnd })) {
                total += taskXpValue;
                if ((task.completions || []).includes(format(taskDate, 'yyyy-MM-dd'))) {
                    achieved += taskXpValue;
                }
            }
        }
    });

    return { weeklyXp: achieved, totalWeeklyXp: total };
  }, [tasks, today]);
  
  const { monthlyXp, totalPossibleMonthlyXp } = useMemo(() => {
    const monthStart = startOfMonth(today);
    let achieved = 0;
    let total = 0;

    tasks.forEach(task => {
        const taskXpValue = getTaskXp(task);
        const completionsForMonth = (task.completions || []).filter(c => isSameMonth(new Date(c), today));

        if (task.type === 'monthly' && task.month === format(today, 'yyyy-MM')) {
            total += taskXpValue;
            if (completionsForMonth.length > 0) {
                achieved += taskXpValue;
            }
        } else if (task.type === 'weekly' && task.week) {
            const taskWeekStartDate = startOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
            if (isSameMonth(taskWeekStartDate, today)) {
                total += taskXpValue;
                if (completionsForMonth.length > 0) {
                    achieved += taskXpValue;
                }
            }
        } else if (task.type === 'single' && task.date) {
            if (isSameMonth(new Date(task.date), today)) {
                total += taskXpValue;
                if (completionsForMonth.length > 0) {
                    achieved += taskXpValue;
                }
            }
        } else if (task.type === 'recurring') {
            const taskStartDate = startOfDay(new Date(task.createdAt));
            if (isSameMonth(taskStartDate, today)) {
                const daysInMonth = getDaysInMonth(today);
                for (let i = 0; i < daysInMonth; i++) {
                    const dayInMonth = addDays(monthStart, i);
                    if (isAfter(dayInMonth, taskStartDate) || isSameDay(dayInMonth, taskStartDate)) {
                        total += taskXpValue;
                        if ((task.completions || []).includes(format(dayInMonth, 'yyyy-MM-dd'))) {
                            achieved += taskXpValue;
                        }
                    }
                }
            }
        }
    });
    
    return { monthlyXp: achieved, totalPossibleMonthlyXp: total };
  }, [tasks, today]);


  const { completedTodayCount, todaysTotalXp, todaysAchievedXp } = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const completedTasks = allTodaysTasks.filter(t => {
      const completionDate = t.type === 'single' && t.date ? format(startOfDay(new Date(t.date)), 'yyyy-MM-dd') : todayStr;
      return (t.completions || []).includes(completionDate);
    });
    const completedCount = completedTasks.length;
    const totalXp = allTodaysTasks.reduce((acc, t) => acc + getTaskXp(t), 0);
    const achievedXp = completedTasks.reduce((acc, t) => acc + getTaskXp(t), 0);
    return { completedTodayCount: completedCount, todaysTotalXp: totalXp, todaysAchievedXp: achievedXp };
  }, [allTodaysTasks, today]);
  
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
          <Card className="border-2 border-black rounded-lg shadow-none dark:bg-[#1a1122] dark:neon-border-purple">
            <CardHeader className='pb-2'>
              <CardTitle className='text-center'>Progress Tracker</CardTitle>
            </CardHeader>
            <CardContent>
                <div className='flex items-center justify-between text-sm font-semibold mb-1'>
                    <span className='flex items-center gap-1.5'><Flame className='w-4 h-4 text-orange-500' /> Your XP</span>
                    <span>{todaysAchievedXp} / {todaysTotalXp} XP</span>
                </div>
                 <div className="w-full bg-muted rounded-full h-4 border-2 border-black p-0.5">
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
              <Card className="border-2 border-black rounded-lg shadow-none dark:neon-border-yellow">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/> Today's Focus</CardTitle>
                      <CardDescription>Tasks for today. ({completedTodayCount}/{allTodaysTasks.length} completed)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="pt-4 space-y-2">
                          {allTodaysTasks.length > 0 ? (
                          allTodaysTasks.map(task => {
                              const todayStart = startOfDay(today);
                              let taskDate, isCompleted;
                              
                              if (task.type === 'single' && task.date) {
                                taskDate = startOfDay(new Date(task.date));
                                isCompleted = (task.completions || []).includes(format(taskDate, 'yyyy-MM-dd'));
                              } else { 
                                taskDate = todayStart;
                                const todayStr = format(taskDate, 'yyyy-MM-dd');
                                isCompleted = (task.completions || []).includes(todayStr);
                              }

                              return (
                                <TaskItem
                                    key={`${task.id}-${format(taskDate, 'yyyy-MM-dd')}`}
                                    task={task}
                                    onToggle={() => onToggle(task.id, taskDate)}
                                    onDelete={() => onDelete(task.id)}
                                    isCompleted={isCompleted}
                                />
                              );
                          })
                          ) : (
                          <p className="text-center text-muted-foreground py-4">No tasks scheduled for today.</p>
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
                <Card className="flex flex-col border-2 border-black rounded-lg shadow-none dark:neon-border-accent">
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
                          Trending up by {totalWeeklyXp > 0 ? ((weeklyXp/totalWeeklyXp) * 100).toFixed(1) : 0}% this week <TrendingUp className="h-4 w-4" />
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
                <Card className="flex flex-col border-2 border-black rounded-lg shadow-none dark:neon-border-chart-3">
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
                        Trending up by {totalPossibleMonthlyXp > 0 ? ((monthlyXp/totalPossibleMonthlyXp) * 100).toFixed(1) : 0}% this month <TrendingUp className="h-4 w-4" />
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
    </div>
  );
}
