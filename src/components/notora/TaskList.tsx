
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
      carryForwardCount: 0,
    };
    
    onDataChange({ ...data, tasks: [...data.tasks, newTask] });
    setNewTaskTitle('');
  };

  return (
    <div className="space-y-4 w-full pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Add a new goal..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          className="flex-grow min-w-[150px] border-2 border-black rounded-md h-9"
        />
        <Select value={addTaskType} onValueChange={(v) => setAddTaskType(v as any)}>
          <SelectTrigger className="w-auto min-w-[120px] border-2 border-black rounded-md h-9 shadow-[2px_2px_0px_#000]">
            <SelectValue placeholder="Task type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        
        {(addTaskType === 'single' || addTaskType === 'weekly') && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-auto min-w-[150px] justify-start text-left font-normal border-2 border-black rounded-md h-9 shadow-[2px_2px_0px_#000]"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {taskDate ? format(taskDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={taskDate}
                onSelect={setTaskDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}

        <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as any)}>
          <SelectTrigger className="w-auto min-w-[120px] border-2 border-black rounded-md h-9 shadow-[2px_2px_0px_#000]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={handleAddTask} className="bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-black rounded-md h-9 shadow-[2px_2px_0px_#000]">
          <Plus className="mr-2 h-4 w-4" /> Add Goal
        </Button>
      </div>
    </div>
  );
}
