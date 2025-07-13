'use client';

import { useState } from 'react';
import TaskItem from './TaskItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppData, Task } from '@/lib/types';
import { Plus, Wand2, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { suggestTaskOrdering } from '@/ai/flows/suggest-task-ordering';

interface TaskListProps {
  tasks: Task[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

const xpMap: Record<Task['priority'], number> = {
  Easy: 10,
  Medium: 25,
  Hard: 50,
};

export default function TaskList({ tasks, data, onDataChange }: TaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('Medium');
  const [optimizing, setOptimizing] = useState(false);
  const { toast } = useToast();

  const handleAddTask = () => {
    if (newTaskTitle.trim() === '') return;

    const newTask: Task = {
      id: uuidv4(),
      title: newTaskTitle.trim(),
      completed: false,
      priority: newTaskPriority,
    };

    onDataChange({ ...data, tasks: [...tasks, newTask] });
    setNewTaskTitle('');
  };

  const handleToggleTask = (id: string) => {
    let xpChange = 0;
    const newTasks = tasks.map((task) => {
      if (task.id === id) {
        xpChange = task.completed ? -xpMap[task.priority] : xpMap[task.priority];
        if(!task.completed) {
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
        return { ...task, completed: !task.completed };
      }
      return task;
    });

    onDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange } });
  };

  const handleDeleteTask = (id: string) => {
    let xpChange = 0;
    const taskToDelete = tasks.find(t => t.id === id);
    if (taskToDelete && taskToDelete.completed) {
        xpChange = -xpMap[taskToDelete.priority];
    }
    const newTasks = tasks.filter((task) => task.id !== id);
    onDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange }});
  };

  const handleOptimizeTasks = async () => {
    setOptimizing(true);
    const uncompletedTasks = tasks.filter(t => !t.completed).map(t => t.title);

    try {
        const { orderedTasks } = await suggestTaskOrdering({ tasks: uncompletedTasks });
        const completedTasks = tasks.filter(t => t.completed);
        const taskMap = new Map(tasks.map(t => [t.title, t]));
        const reorderedUncompleted = orderedTasks.map(title => taskMap.get(title)).filter(Boolean) as Task[];
        
        onDataChange({ ...data, tasks: [...completedTasks, ...reorderedUncompleted] });
        
        toast({
            title: "Tasks Optimized! 🧠",
            description: "Your task list has been reordered for maximum productivity.",
        });
    } catch (error) {
        console.error("Failed to optimize tasks:", error);
        toast({
            variant: "destructive",
            title: "Optimization Failed",
            description: "Could not reorder tasks at this time.",
        });
    } finally {
        setOptimizing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add a new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
        />
        <Select value={newTaskPriority} onValueChange={(v: Task['priority']) => setNewTaskPriority(v)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleAddTask}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-2">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
            />
          ))
        ) : (
          <p className="text-center text-muted-foreground p-4">No tasks yet. Add one to get started!</p>
        )}
      </div>

      {tasks.filter(t => !t.completed).length > 1 && (
        <div className="flex justify-start pt-4">
            <Button variant="outline" onClick={handleOptimizeTasks} disabled={optimizing}>
                {optimizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {optimizing ? 'Optimizing...' : 'Optimize Task Order'}
            </Button>
        </div>
      )}
    </div>
  );
}
