
'use client';

import { useState } from 'react';
import TaskItem from './TaskItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppData, Task } from '@/lib/types';
import { Plus, Wand2, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { suggestTaskOrdering } from '@/ai/flows/suggest-task-ordering';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format, addMonths } from 'date-fns';

interface TaskListProps {
  tasks: Task[];
  data: AppData;
  onDataChange: (data: AppData) => void;
  selectedDate: Date;
  taskType: 'single' | 'recurring' | 'monthly';
  currentMonth?: Date;
}

const xpMap: Record<Task['priority'], number> = {
  Easy: 10,
  Medium: 25,
  Hard: 50,
};

export default function TaskList({ tasks, data, onDataChange, selectedDate, taskType, currentMonth }: TaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('Medium');
  const [optimizing, setOptimizing] = useState(false);
  const [addTaskType, setAddTaskType] = useState<'single' | 'recurring' | 'monthly'>('single');
  const [taskDate, setTaskDate] = useState<Date | undefined>(new Date());
  const [taskMonth, setTaskMonth] = useState<Date>(currentMonth || new Date());
  
  const { toast } = useToast();

  const handleAddTask = () => {
    if (newTaskTitle.trim() === '') return;

    const newTask: Task = {
      id: uuidv4(),
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      type: addTaskType,
      completions: [],
      date: addTaskType === 'single' ? taskDate?.toISOString() : undefined,
      month: addTaskType === 'monthly' ? format(taskMonth, 'yyyy-MM') : undefined,
    };
    
    onDataChange({ ...data, tasks: [...data.tasks, newTask] });
    setNewTaskTitle('');
  };

  const handleToggleTask = (id: string, date: Date) => {
    let xpChange = 0;
    const todayStr = format(date, 'yyyy-MM-dd');
    const newTasks = data.tasks.map((task) => {
      if (task.id === id) {
        xpChange = xpMap[task.priority];
        const isCompleted = task.completions.includes(todayStr);
        let newCompletions;
        if (isCompleted) {
            xpChange = -xpChange;
            newCompletions = task.completions.filter(d => d !== todayStr);
        } else {
            newCompletions = [...task.completions, todayStr];
        }

        if(!isCompleted) {
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
        return { ...task, completions: newCompletions };
      }
      return task;
    });

    onDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange } });
  };

  const handleDeleteTask = (id: string) => {
    let xpChange = 0;
    const taskToDelete = data.tasks.find(t => t.id === id);
    if (taskToDelete) {
       xpChange = -xpMap[taskToDelete.priority] * taskToDelete.completions.length;
    }
    const newTasks = data.tasks.filter((task) => task.id !== id);
    onDataChange({ ...data, tasks: newTasks, userStats: { xp: data.userStats.xp + xpChange }});
  };

  const handleOptimizeTasks = async () => {
    setOptimizing(true);
    const todayStr = format(selectedDate, 'yyyy-MM-dd');
    const uncompletedTasksForDay = tasks.filter(t => !t.completions.includes(todayStr)).map(t => t.title);

    try {
        const { orderedTasks } = await suggestTaskOrdering({ tasks: uncompletedTasksForDay });
        
        const tasksForDayMap = new Map(tasks.map(t => [t.title, t]));

        const reorderedUncompleted = orderedTasks.map(title => tasksForDayMap.get(title)).filter((t): t is Task => !!t);

        const completedTasksForDay = tasks.filter(t => t.completions.includes(todayStr));

        const otherTasks = data.tasks.filter(t => !tasks.includes(t));

        const newTaskList = [
            ...otherTasks,
            ...completedTasksForDay,
            ...reorderedUncompleted
        ];

        onDataChange({ ...data, tasks: newTaskList });
        
        toast({
            title: "Tasks Optimized! 🧠",
            description: "Today's task list has been reordered for maximum productivity.",
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
  
  const todayStr = format(selectedDate, 'yyyy-MM-dd');

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Add a new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          className="flex-grow min-w-[150px]"
        />
        <Select value={newTaskPriority} onValueChange={(v: Task['priority']) => setNewTaskPriority(v)}>
          <SelectTrigger className="w-auto">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={addTaskType} onValueChange={(v: 'single' | 'recurring' | 'monthly') => setAddTaskType(v)}>
          <SelectTrigger className="w-auto">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        {addTaskType === 'single' && (
             <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className="w-auto justify-start text-left font-normal"
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
        {addTaskType === 'monthly' && (
             <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className="w-auto justify-start text-left font-normal"
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(taskMonth, "MMMM yyyy")}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={taskMonth}
                    onSelect={(day) => setTaskMonth(day || new Date())}
                    onMonthChange={setTaskMonth}
                    footer={
                        <div className="flex justify-around p-2">
                            <Button size="sm" onClick={() => setTaskMonth(subMonths(taskMonth, 1))}>Prev</Button>
                            <Button size="sm" onClick={() => setTaskMonth(addMonths(taskMonth, 1))}>Next</Button>
                        </div>
                    }
                />
                </PopoverContent>
            </Popover>
        )}
        <Button onClick={handleAddTask}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-2">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskItem
              key={`${task.id}-${taskType === 'single' ? selectedDate.toISOString() : ''}`}
              task={task}
              onToggle={(id) => handleToggleTask(id, selectedDate)}
              onDelete={handleDeleteTask}
              isCompleted={task.completions.includes(todayStr)}
            />
          ))
        ) : (
          taskType !== 'single' && <p className="text-center text-muted-foreground p-4">No tasks of this type. Add one to get started!</p>
        )}
      </div>

      {tasks.filter(t => !t.completions.includes(todayStr)).length > 1 && (
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
