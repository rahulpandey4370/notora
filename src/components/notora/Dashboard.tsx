'use client';

import type { User, AppData, Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { PieChart, Pie, Cell } from "recharts"
import TaskList from './TaskList';
import TaskItem from './TaskItem';
import { useMemo } from 'react';
import { Award, CheckSquare, StickyNote, ArrowRight, Calendar, BarChart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isSameMonth } from 'date-fns';
import { getTaskXp } from '@/lib/utils';
import { useApp } from '@/hooks/use-app';

interface DashboardProps {
  user: User;
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function Dashboard({ user, data, onDataChange }: DashboardProps) {
  const { noteBoards, userStats, tasks } = data;
  const { toast } = useApp();
  const today = new Date();

  const onToggle = (id: string) => {
    let xpChange = 0;
    const newTasks = data.tasks.map((task) => {
      if (task.id === id) {
        const taskXp = getTaskXp(task);
        
        const relevantDate = task.type === 'monthly' ? startOfMonth(today) : today;
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
        xpChange = -(taskToDelete.completions || []).reduce((acc, c) => acc + taskXp, 0);
    }
    const newTasks = data.tasks.filter((task) => task.id !== id);
    onDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange }});
  };

  const todaysTasks = useMemo(() => {
    return tasks.filter(task => {
        if (task.type === 'recurring') return true;
        if (task.type === 'single' && task.date && isSameDay(new Date(task.date), today)) return true;
        if (task.type === 'weekly' && task.week) {
             const taskWeekDate = startOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
             return isWithinInterval(today, { start: taskWeekDate, end: endOfWeek(taskWeekDate, { weekStartsOn: 1 }) });
        }
        return false;
    });
  }, [tasks, today]);

  const recentNotes = useMemo(() => {
    return noteBoards.flatMap(board => board.notes).slice(0, 3);
  }, [noteBoards]);

  // XP Calculations
  const { weeklyXp, weeklyTotalXp, monthlyXp, monthlyTotalXp, todaysAchievedXp, todaysTotalPossibleXp } = useMemo(() => {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    let weeklyXp = 0, weeklyTotalXp = 0, monthlyXp = 0, monthlyTotalXp = 0, todaysAchievedXp = 0, todaysTotalPossibleXp = 0;

    todaysTasks.forEach(task => {
        const taskXp = getTaskXp(task);
        todaysTotalPossibleXp += taskXp;
        const todayStr = format(today, 'yyyy-MM-dd');
        if ((task.completions || []).includes(todayStr)) {
            todaysAchievedXp += taskXp;
        }
    })
    
    tasks.forEach(task => {
        const taskXpValue = getTaskXp(task);
        if (task.type === 'monthly' && task.month === format(today, 'yyyy-MM')) {
            monthlyTotalXp += taskXpValue;
        } else if (task.type === 'weekly' && task.week) {
            const taskWeekDate = startOfWeek(new Date(task.week.replace(/(\d{4})-(\d{2})/, '$1-W$2-1')), { weekStartsOn: 1 });
            if(isWithinInterval(taskWeekDate, { start: monthStart, end: monthEnd })) {
                 monthlyTotalXp += taskXpValue;
            }
            if (isSameDay(taskWeekDate, weekStart)) {
                weeklyTotalXp += taskXpValue;
            }
        } else if (task.type === 'single' && task.date) {
            const taskDate = new Date(task.date);
            if (isWithinInterval(taskDate, { start: monthStart, end: monthEnd })) {
                monthlyTotalXp += taskXpValue;
            }
            if (isWithinInterval(taskDate, { start: weekStart, end: weekEnd })) {
                weeklyTotalXp += taskXpValue;
            }
        } else if (task.type === 'recurring') {
            const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            monthlyTotalXp += taskXpValue * daysInMonth(today);
            weeklyTotalXp += taskXpValue * 7;
        }

        (task.completions || []).forEach(c => {
            const completionDate = new Date(c);
            if (isSameMonth(completionDate, today)) {
                monthlyXp += taskXpValue;
            }
            if (isWithinInterval(completionDate, { start: weekStart, end: weekEnd })) {
                weeklyXp += taskXpValue;
            }
        })
    });
    return { weeklyXp, weeklyTotalXp, monthlyXp, monthlyTotalXp, todaysAchievedXp, todaysTotalPossibleXp };
  }, [tasks, today, todaysTasks]);

  const weeklyTarget = weeklyTotalXp * 0.7;
  const monthlyTarget = monthlyTotalXp * 0.7;
  const todaysProgress = todaysTotalPossibleXp > 0 ? (todaysAchievedXp / todaysTotalPossibleXp) * 100 : 0;
  
  const weeklyChartData = [{ name: 'achieved', value: weeklyXp, fill: 'hsl(var(--primary))' }, { name: 'remaining', value: Math.max(0, weeklyTotalXp - weeklyXp), fill: 'hsl(var(--muted))' }];
  const monthlyChartData = [{ name: 'achieved', value: monthlyXp, fill: 'hsl(var(--primary))' }, { name: 'remaining', value: Math.max(0, monthlyTotalXp - monthlyXp), fill: 'hsl(var(--muted))' }];

  const chartConfig: ChartConfig = {
    achieved: { label: "Achieved", color: "hsl(var(--primary))" },
    remaining: { label: "Remaining", color: "hsl(var(--muted))" },
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold">Welcome back, {user.username}!</h1>
                <p className="text-muted-foreground">Here's your productivity pulse for today.</p>
            </div>
            <div className="flex items-center gap-2 text-lg font-semibold text-primary">
              <Award className="w-6 h-6" />
              <span>{todaysAchievedXp} / {todaysTotalPossibleXp} XP Today</span>
            </div>
        </div>
        
        <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Today's Progress</span>
            <Progress value={todaysProgress} className="h-2" />
        </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                  <div className='flex items-center gap-2'>
                      <CheckSquare className="w-5 h-5" />
                      <CardTitle>Today's Focus</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                      <Link href="/tasks">Manage All Tasks <ArrowRight className="ml-2 w-4 h-4"/></Link>
                  </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                 <TaskList 
                    data={data}
                    onDataChange={onDataChange}
                    currentMonth={today}
                 />
                 <div className="space-y-2 pt-4 border-t">
                    {todaysTasks.length > 0 ? (
                        todaysTasks.map(task => (
                            <TaskItem
                                key={`${task.id}-${format(today, 'yyyy-MM-dd')}`}
                                task={task}
                                onToggle={() => onToggle(task.id)}
                                onDelete={() => onDelete(task.id)}
                                isCompleted={(task.completions || []).includes(format(today, 'yyyy-MM-dd')) || (task.type === 'monthly' && (task.completions || []).includes(format(startOfMonth(today), 'yyyy-MM-dd')))}
                            />
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-4">No tasks for today. Add one above!</p>
                    )}
                 </div>
              </CardContent>
          </Card>
          <div className='space-y-6'>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/> Weekly Goal</CardTitle>
                    <CardDescription>
                        Target: {Math.round(weeklyTarget)} XP. You've earned {weeklyXp} XP so far this week.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex justify-center items-center'>
                     <ChartContainer config={chartConfig} className="mx-auto aspect-square h-48">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={weeklyChartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                {weeklyChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart className="w-5 h-5"/> Monthly Goal</CardTitle>
                    <CardDescription>
                       Target: {Math.round(monthlyTarget)} XP. You've earned {monthlyXp} XP so far this month.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex justify-center items-center'>
                    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-48">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={monthlyChartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                {monthlyChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                      <StickyNote className="w-5 h-5" />
                      Recent Notes
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                      <Link href="/notes">View All Notes <ArrowRight className="ml-2 w-4 h-4"/></Link>
                  </Button>
              </CardHeader>
              <CardContent>
                 {recentNotes.length > 0 ? (
                      <div className="space-y-2">
                          {recentNotes.map(note => (
                              <div key={note.id} className="p-2 rounded-md bg-secondary/50">
                                  <p className="text-sm text-muted-foreground truncate">{note.content || "Empty Note"}</p>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No recent notes.</p>
                  )}
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}
