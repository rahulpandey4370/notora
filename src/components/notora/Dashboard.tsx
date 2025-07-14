'use client';

import type { User, AppData, Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import TaskList from './TaskList';
import TaskItem from './TaskItem';
import { useMemo } from 'react';
import { Flame, Zap, Trash2, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isSameMonth, startOfDay } from 'date-fns';
import { getTaskXp } from '@/lib/utils';
import { useApp } from '@/hooks/use-app';

interface DashboardProps {
  user: User;
  data: AppData;
  onDataChange: (data: AppData) => void;
}

const ProgressBar = ({ value, className }: { value: number, className?: string }) => (
    <div className={`h-4 w-full border-2 border-black bg-card ${className}`}>
        <div style={{ width: `${value}%`}} className="h-full bg-primary" />
    </div>
);

export default function Dashboard({ user, data, onDataChange }: DashboardProps) {
  const { tasks } = data;
  const { toast } = useApp();
  const today = new Date();

  const onToggle = (id: string) => {
    let xpChange = 0;
    const newTasks = data.tasks.map((task) => {
      if (task.id === id) {
        const taskXp = getTaskXp(task);
        
        const relevantDate = task.type === 'monthly' ? startOfMonth(today) : startOfDay(today);
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
        xpChange = -(taskToDelete.completions || []).length * taskXp;
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

  const { todaysAchievedXp } = useMemo(() => {
    let todaysAchievedXp = 0;
    
    todaysTasks.forEach(task => {
        const taskXp = getTaskXp(task);
        const relevantDateStr = task.type === 'monthly' ? format(startOfMonth(today), 'yyyy-MM-dd') : format(startOfDay(today), 'yyyy-MM-dd');
        if ((task.completions || []).includes(relevantDateStr)) {
            todaysAchievedXp += taskXp;
        }
    })
    
    return { todaysAchievedXp };
  }, [tasks, today, todaysTasks]);
  

  const completedTodayCount = useMemo(() => {
    return todaysTasks.filter(task => (task.completions || []).includes(format(today, 'yyyy-MM-dd'))).length;
  }, [todaysTasks, today]);

  const dailyProgress = todaysTasks.length > 0 ? (completedTodayCount / todaysTasks.length) * 100 : 0;
  
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
        
        <Card className="border-2 border-black rounded-lg shadow-none">
            <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold">Progress Tracker</CardTitle>
                <div className="w-24 h-1 bg-accent mx-auto mt-2" />
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
                <div className="flex items-center gap-4">
                    <Flame className="w-5 h-5 text-orange-500"/>
                    <span className="font-semibold w-20">Your XP</span>
                    <div className="flex-1 flex items-center gap-2">
                        <ProgressBar value={dailyProgress} />
                        <span className="text-sm font-mono">{Math.round(todaysAchievedXp)} / 1000 XP</span>
                    </div>
                </div>
                 <div className="flex items-center gap-4">
                    <Zap className="w-5 h-5 text-purple-500"/>
                    <span className="font-semibold w-20">Rival XP</span>
                    <div className="flex-1 flex items-center gap-2">
                        <ProgressBar value={0} />
                        <span className="text-sm font-mono">0 / 1000 XP</span>
                    </div>
                </div>
            </CardContent>
        </Card>
      
        <Card className="border-2 border-black rounded-lg shadow-none">
              <CardHeader className="text-center">
                  <CardTitle className="text-xl font-bold">Daily Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-6 pb-6">
                 <div className="space-y-2">
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
                        <p className="text-center text-muted-foreground py-4">No tasks for today. Add one below!</p>
                    )}
                 </div>
                 <div className="pt-4">
                    <TaskList 
                        data={data}
                        onDataChange={onDataChange}
                        currentMonth={today}
                    />
                 </div>
              </CardContent>
          </Card>
    </div>
  );
}
