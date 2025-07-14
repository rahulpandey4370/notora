'use client';

import type { User, AppData, Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMemo } from 'react';
import { BarChart as BarChartIcon, Calendar, Target, Flame } from 'lucide-react';
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isSameMonth, isAfter, addDays } from 'date-fns';
import { getTaskXp } from '@/lib/utils';
import { useApp } from '@/hooks/use-app';
import { PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart, Bar, XAxis, YAxis, Tooltip, BarChart, Label } from "recharts"
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

const monthlyChartConfig = {
  xp: {
    label: "XP",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

const weeklyChartConfig = {
  xp: {
    label: "XP",
  },
  weekly: {
    label: "Weekly XP",
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
        const createdAt = new Date(task.createdAt);
        if (task.type === 'single' && task.date && isSameDay(new Date(task.date), today)) return true;
        
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
  
  const monthlyChartData = useMemo(() => {
    const monthStart = startOfMonth(today);
    const daysInMonth = format(today, 'd');
    const dailyData = Array.from({ length: Number(daysInMonth) }, (_, i) => ({
      date: format(addDays(monthStart, i), 'MMM d'),
      xp: 0,
    }));

    tasks.forEach(task => {
        const taskXpValue = getTaskXp(task);
        (task.completions || []).forEach(completionStr => {
            const completionDate = new Date(completionStr);
            if (isSameMonth(completionDate, today)) {
                const dayIndex = completionDate.getDate() - 1;
                if(dailyData[dayIndex]) {
                  dailyData[dayIndex].xp += taskXpValue;
                }
            }
        });
    });

    return dailyData;
  }, [tasks, today]);

  const { completedTodayCount, todaysTotalXp, todaysAchievedXp } = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const completedTasks = todaysTasks.filter(t => (t.completions || []).includes(todayStr));
    const completedCount = completedTasks.length;
    const totalXp = todaysTasks.reduce((acc, t) => acc + getTaskXp(t), 0);
    const achievedXp = completedTasks.reduce((acc, t) => acc + getTaskXp(t), 0);
    return { completedTodayCount: completedCount, todaysTotalXp: totalXp, todaysAchievedXp: achievedXp };
  }, [todaysTasks, today]);
  
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
            <motion.div whileHover={{ y: -5, transition: { duration: 0.2 } }}>
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
                                  isCompleted={(todaysTasks.find(t => t.id === task.id)?.completions || []).includes(format(today, 'yyyy-MM-dd'))}
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
          </motion.div>

          <div className="space-y-6">
             <motion.div
                variants={animationVariants}
                initial="hidden"
                animate="visible"
                custom={1}
            >
              <motion.div whileHover={{ y: -5, transition: { duration: 0.2 } }}>
                <Card className="border-2 border-black rounded-lg shadow-none">
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
                            endAngle={360 * (weeklyXp / (totalWeeklyXp || 1))}
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
                    <div className="flex-col gap-2 text-sm text-center pb-4">
                      <div className="text-muted-foreground leading-none">
                        You've earned {weeklyXp} of {totalWeeklyXp} possible XP this week.
                      </div>
                    </div>
                </Card>
              </motion.div>
            </motion.div>

            <motion.div
                variants={animationVariants}
                initial="hidden"
                animate="visible"
                custom={2}
            >
              <motion.div whileHover={{ y: -5, transition: { duration: 0.2 } }}>
                <Card className="border-2 border-black rounded-lg shadow-none">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5"/> Monthly Progress</CardTitle>
                      <CardDescription>Daily XP earned for {format(today, 'MMMM')}.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <ChartContainer config={monthlyChartConfig} className="w-full h-[250px]">
                          <BarChart data={monthlyChartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                              <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                              <Tooltip 
                                  cursor={{ fill: 'hsl(var(--accent) / 0.1)' }}
                                  content={({ active, payload, label }) =>
                                  active && payload && payload.length ? (
                                    <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-2 text-sm shadow-lg">
                                      <p className="font-bold">{`${label}`}</p>
                                      <p className="text-primary">{`XP: ${payload[0].value}`}</p>
                                    </div>
                                  ) : null
                                }
                              />
                              <Bar dataKey="xp" fill="url(#colorXp)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                      </ChartContainer>
                  </CardContent>
                </Card>
              </motion.div>
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
