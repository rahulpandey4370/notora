'use client';

import type { User, AppData, Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMemo } from 'react';
import { BarChart, Calendar, Target, Flame } from 'lucide-react';
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isSameMonth, startOfDay, isAfter, addDays, differenceInDays } from 'date-fns';
import { getTaskXp } from '@/lib/utils';
import { useApp } from '@/hooks/use-app';
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import TaskList from './TaskList';
import TaskItem from './TaskItem';
import { motion } from 'framer-motion';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';


const weeklyChartConfig = {
  achieved: {
    label: "Achieved",
    color: "hsl(var(--primary))",
  },
  remaining: {
    label: "Remaining",
    color: "hsl(var(--muted))",
  },
} satisfies ChartConfig

const monthlyChartConfig = {
  xp: {
    label: "XP",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export default function Dashboard({ user, data, onDataChange }: DashboardProps) {
  const { tasks } = data;
  const { toast } = useApp();
  const today = new Date();

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

  const todaysTasks = useMemo(() => {
    return tasks.filter(task => {
        if (task.type === 'single' && task.date && isSameDay(new Date(task.date), today)) return true;
        
        const createdAt = new Date(task.createdAt);
        if (task.type === 'recurring') {
            return isSameDay(today, createdAt) || isAfter(today, createdAt);
        }

        if (task.type === 'weekly' && task.week) {
             const taskWeekDate = startOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
             return isWithinInterval(today, { start: taskWeekDate, end: endOfWeek(taskWeekDate, { weekStartsOn: 1 }) });
        }
        return false;
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
        } else if (task.type === 'recurring' || task.type === 'single') {
            const taskDate = task.date ? new Date(task.date) : new Date(task.createdAt);
            if (isWithinInterval(taskDate, { start: weekStart, end: weekEnd })) {
                 if (task.type === 'recurring') {
                    for (let i = 0; i < 7; i++) {
                        const day = addDays(weekStart, i);
                        if (isSameDay(day, taskDate) || isAfter(day, taskDate)) {
                            total += taskXpValue;
                        }
                    }
                 } else {
                    total += taskXpValue;
                 }

                (task.completions || []).forEach(c => {
                    if (isWithinInterval(new Date(c), { start: weekStart, end: weekEnd })) {
                        achieved += taskXpValue;
                    }
                });
            }
        }
    });

    return { weeklyXp: achieved, totalWeeklyXp: total };
  }, [tasks, today]);
  
  const { monthlyXp, totalMonthlyXp } = useMemo(() => {
    let mXp = 0;
    let tMXp = 0;
    
    tasks.forEach(task => {
        const taskXpValue = getTaskXp(task);
        const createdAt = new Date(task.createdAt);
        
        if (task.type === 'monthly' && task.month === format(today, 'yyyy-MM')) {
            tMXp += taskXpValue;
        } else if (task.type === 'recurring' && isSameMonth(createdAt, today)) {
             const monthEnd = endOfMonth(today);
             let daysInMonth = differenceInDays(monthEnd, createdAt) + 1;
             tMXp += daysInMonth * taskXpValue;
        } else if (task.type === 'single' && task.date && isSameMonth(new Date(task.date), today)) {
            tMXp += taskXpValue;
        } else if (task.type === 'weekly' && task.week) {
            const taskWeekDate = startOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
            if(isSameMonth(taskWeekDate, today)) {
                tMXp += taskXpValue;
            }
        }

        (task.completions || []).forEach(c => {
            const completionDate = new Date(c);
            if (isSameMonth(completionDate, today)) {
                mXp += taskXpValue;
            }
        });
    });

    return { monthlyXp: mXp, totalMonthlyXp: tMXp };
  }, [tasks, today]);

  const { dailyProgress, completedTodayCount, todaysTotalXp, todaysAchievedXp } = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const completedTasks = todaysTasks.filter(t => (t.completions || []).includes(todayStr));
    const completedCount = completedTasks.length;
    const progress = todaysTasks.length > 0 ? (completedCount / todaysTasks.length) * 100 : 0;
    const totalXp = todaysTasks.reduce((acc, t) => acc + getTaskXp(t), 0);
    const achievedXp = completedTasks.reduce((acc, t) => acc + getTaskXp(t), 0);
    return { dailyProgress: progress, completedTodayCount: completedCount, todaysTotalXp: totalXp, todaysAchievedXp: achievedXp };
  }, [todaysTasks, today]);

  const weeklyChartData = [{ week: "current", achieved: weeklyXp, remaining: Math.max(0, totalWeeklyXp - weeklyXp) }];
  const monthlyChartData = [{ month: "current", xp: monthlyXp }];
  const monthlyProgress = totalMonthlyXp > 0 ? (monthlyXp / totalMonthlyXp) * 100 : 0;
  
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

  return (
    <div className="p-4 md:p-8 space-y-6">
        <motion.div variants={animationVariants} initial="hidden" animate="visible" custom={0}>
          <Card className="border-2 border-black rounded-lg shadow-none">
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
            custom={3}
          >
            <Card className="border-2 border-black rounded-lg shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/> Today's Focus</CardTitle>
                    <CardDescription>Tasks scheduled for {format(today, 'MMMM do')}. ({completedTodayCount}/{todaysTasks.length} completed)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="pt-4 space-y-2">
                        {todaysTasks.length > 0 ? (
                        todaysTasks.map(task => (
                            <TaskItem
                                key={`${task.id}-${format(today, 'yyyy-MM-dd')}`}
                                task={task}
                                onToggle={() => onToggle(task.id, today)}
                                onDelete={() => onDelete(task.id)}
                                isCompleted={(task.completions || []).includes(format(today, 'yyyy-MM-dd'))}
                            />
                        ))
                        ) : (
                        <p className="text-center text-muted-foreground py-4">No tasks scheduled for today.</p>
                        )}
                    </div>
                    <TaskList 
                        data={data}
                        onDataChange={onDataChange}
                        currentMonth={today}
                    />
                </CardContent>
            </Card>
          </motion.div>

          <div className="space-y-6">
             <motion.div
                variants={animationVariants}
                initial="hidden"
                animate="visible"
                custom={1}
            >
                <Card className="border-2 border-black rounded-lg shadow-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BarChart className="w-5 h-5"/> Weekly Progress</CardTitle>
                        <CardDescription>Your XP summary for this week.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer
                        config={weeklyChartConfig}
                        className="mx-auto aspect-square max-h-[250px]"
                        >
                        <RadialBarChart
                            data={weeklyChartData}
                            startAngle={-90}
                            endAngle={270}
                            innerRadius={80}
                            outerRadius={110}
                        >
                            <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel nameKey="name" />}
                            />
                            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                            <Label
                                content={({ viewBox }) => {
                                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                    return (
                                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                                        <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy || 0) - 16}
                                        className="fill-foreground text-2xl font-bold"
                                        >
                                        {weeklyXp.toLocaleString()}
                                        </tspan>
                                        <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy || 0) + 4}
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
                            <RadialBar
                                dataKey="achieved"
                                stackId="a"
                                cornerRadius={5}
                                fill="var(--color-achieved)"
                                className="stroke-transparent stroke-2"
                            />
                            <RadialBar
                                dataKey="remaining"
                                fill="var(--color-remaining)"
                                stackId="a"
                                cornerRadius={5}
                                className="stroke-transparent stroke-2"
                            />
                        </RadialBarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div
                variants={animationVariants}
                initial="hidden"
                animate="visible"
                custom={2}
            >
                <Card className="border-2 border-black rounded-lg shadow-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5"/> Monthly Goal</CardTitle>
                        <CardDescription>Your XP goal for {format(today, 'MMMM')}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer
                            config={monthlyChartConfig}
                            className="mx-auto aspect-square max-h-[250px]"
                        >
                        <RadialBarChart
                            data={monthlyChartData}
                            startAngle={90}
                            endAngle={90 - (360 * (monthlyProgress / 100))}
                            innerRadius={80}
                            outerRadius={110}
                        >
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
                            <RadialBar 
                                dataKey="xp" 
                                background 
                                cornerRadius={10} 
                                fill="var(--color-xp)"
                            />
                        </RadialBarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </motion.div>
          </div>
        </div>
    </div>
  );
}

interface DashboardProps {
  user: User;
  data: AppData;
  onDataChange: (data: AppData) => void;
}
