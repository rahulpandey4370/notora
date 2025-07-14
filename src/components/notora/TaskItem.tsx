'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { getTaskXp } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  isCompleted: boolean;
}

export default function TaskItem({ task, onToggle, onDelete, isCompleted }: TaskItemProps) {
  const uniqueId = `task-${task.id}-${task.date || ''}`;
  const taskXp = getTaskXp(task);

  return (
    <div className="flex items-center gap-4 p-2 border-2 border-black rounded-md bg-card">
      <Checkbox
        id={uniqueId}
        checked={isCompleted}
        onCheckedChange={onToggle}
        aria-labelledby={`${uniqueId}-label`}
        className="w-5 h-5 border-2 border-black rounded-none data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
      />
      <label
        id={`${uniqueId}-label`}
        htmlFor={uniqueId}
        className={`flex-1 text-sm cursor-pointer ${isCompleted ? 'text-muted-foreground line-through' : ''}`}
      >
        {task.title} - <span className="text-primary font-bold">{taskXp} XP</span>
      </label>
      
      <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-black hover:bg-destructive/20">
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  );
}
