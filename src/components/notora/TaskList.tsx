
'use client';

import { useState } from 'react';
import type { AppData, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar as CalendarIcon, Sparkles, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format, getWeek, addMonths, subMonths, startOfWeek, parseISO } from 'date-fns';
import { useModelStore } from '@/hooks/use-model-store';
import { useToast } from '@/hooks/use-toast';
import { parseTask } from '@/ai/flows/parse-task';
import { toYmd } from '@/lib/date-utils';

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
  const [isParsing, setIsParsing] = useState(false);
  const { selectedModel } = useModelStore();
  const { toast } = useToast();

  /**
   * Fill the structured fields from one plain-English line, so a task with a
   * non-default date and priority costs one action instead of four separate
   * dropdown/popover round-trips. The fields are populated rather than
   * submitted — a misparse never silently creates the wrong task.
   */
  const handleAiFill = async () => {
    const text = newTaskTitle.trim();
    if (!text) return;
    setIsParsing(true);
    try {
      const parsed = await parseTask(
        {
          naturalLanguageText: text,
          // Computed in the browser so a late-night entry isn't filed against
          // the previous UTC day.
          todayYmd: format(new Date(), 'yyyy-MM-dd'),
        },
        selectedModel
      );
      setNewTaskTitle(parsed.title);
      setNewTaskPriority(parsed.priority);
      setAddTaskType(parsed.type);
      if (parsed.date) setTaskDate(parseISO(parsed.date));

      const bits = [parsed.type, parsed.priority, parsed.date ? format(parseISO(parsed.date), 'MMM d') : null]
        .filter(Boolean)
        .join(' · ');
      toast({ title: 'Filled from your text', description: `${bits}. Review, then Add.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: "Couldn't parse that", description: err?.message ?? 'Set the fields manually.' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim() === '') return;

    const newTask: Task = {
      id: uuidv4(),
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      type: addTaskType,
      completions: [],
      createdAt: new Date().toISOString(),
      date: addTaskType === 'single' && taskDate ? toYmd(taskDate) : undefined,
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
          placeholder='Add a goal — or type "gym tomorrow 7am high priority" and hit Fill with AI'
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds directly; Cmd/Ctrl+Enter routes through the parser so
            // both the fast path and the smart path are keyboard-reachable.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleAiFill();
            } else if (e.key === 'Enter') {
              handleAddTask();
            }
          }}
          className="flex-grow min-w-[150px] nb-border rounded-md h-9"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAiFill}
          disabled={isParsing || !newTaskTitle.trim()}
          title="Parse date, priority and repeat from your text (⌘↵)"
          className="nb-border rounded-md h-9 nb-shadow-sm"
        >
          {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {isParsing ? 'Reading…' : 'Fill with AI'}
        </Button>
        <Select value={addTaskType} onValueChange={(v) => setAddTaskType(v as any)}>
          <SelectTrigger className="w-auto min-w-[120px] nb-border rounded-md h-9 nb-shadow-sm">
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
                className="w-auto min-w-[150px] justify-start text-left font-normal nb-border rounded-md h-9 nb-shadow-sm"
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
          <SelectTrigger className="w-auto min-w-[120px] nb-border rounded-md h-9 nb-shadow-sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={handleAddTask} className="bg-primary hover:bg-primary/90 text-primary-foreground nb-border rounded-md h-9 nb-shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Add Goal
        </Button>
      </div>
    </div>
  );
}
