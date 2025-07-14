
'use client';

import { useState } from 'react';
import type { AppData, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format, getWeek, addMonths, subMonths, startOfWeek } from 'date-fns';

interface TaskListProps {
  data: AppData;
  onDataChange: (data: AppData) => void;
  currentMonth: Date;
}

export default function TaskList({ data, onDataChange, currentMonth }: TaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('Medium');
  const [addTaskType, setAddTaskType] = useState<'single' | 'recurring' | 'monthly' | 'weekly'>('single');
  const [taskDate, setTaskDate] = useState<Date | undefined>(new Date());
  
  const handleAddTask = () => {
    if (newTaskTitle.trim() === '') return;

    const newTask: Task = {
      id: uuidv4(),
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      type: addTaskType,
      completions: [],
      createdAt: new Date().toISOString(),
      date: addTaskType === 'single' && taskDate ? taskDate.toISOString() : undefined,
      month: addTaskType === 'monthly' ? format(currentMonth, 'yyyy-MM') : undefined,
      week: addTaskType === 'weekly' && taskDate ? `${format(taskDate, 'yyyy')}-${getWeek(taskDate)}` : undefined,
    };
    
    onDataChange({ ...data, tasks: [...data.tasks, newTask] });
    setNewTaskTitle('');
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Read book"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          className="flex-grow min-w-[150px] border-2 border-black rounded-md h-9"
        />
        <Button onClick={handleAddTask} className="bg-primary/80 hover:bg-primary text-primary-foreground border-2 border-black rounded-md h-9">
          <Plus className="mr-2 h-4 w-4" /> Add Goal
        </Button>
      </div>
    </div>
  );
}
