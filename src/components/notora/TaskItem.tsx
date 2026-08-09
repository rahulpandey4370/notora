'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronsRight } from "lucide-react";
import type { Task } from "@/lib/types";
import { getTaskXp } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { motion } from 'framer-motion';
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  isCompleted: boolean;
  onCarryForward?: () => void;
  isPastDue?: boolean;
  className?: string;
}

const priorityStyles = {
    Easy: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300",
    Medium: "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    Hard: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
}

export default function TaskItem({ task, onToggle, onDelete, isCompleted, onCarryForward, isPastDue = false, className }: TaskItemProps) {
  const uniqueId = `task-${task.id}-${task.date || ''}`;
  const taskXp = getTaskXp(task);
  const { resolvedTheme } = useTheme();
  
  const isOverdue = isPastDue && !isCompleted;
  const canCarryForward = !!onCarryForward;

  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        "flex items-center gap-4 p-3 nb-border rounded-lg bg-card hover:nb-shadow transition-shadow duration-200",
        isOverdue && "bg-muted/50 opacity-70",
        className
      )}
    >
      <div
        className="flex items-center gap-4 flex-1 rounded-md"
      >
        <Checkbox
          id={uniqueId}
          checked={isCompleted}
          onCheckedChange={onToggle}
          aria-labelledby={`${uniqueId}-label`}
          className="w-5 h-5 nb-border rounded-sm data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:border-slate-700"
          disabled={isOverdue}
        />
        <label
          id={`${uniqueId}-label`}
          htmlFor={uniqueId}
          className={cn(
            'flex-1 text-sm font-medium cursor-pointer transition-all',
            isOverdue && 'cursor-not-allowed'
          )}
        >
          <span className={cn(
            isCompleted && 'line-through bg-primary/70 text-muted-foreground px-2 rounded-sm',
            isOverdue && 'text-muted-foreground'
          )}>
            {task.title}
          </span>
        </label>
      </div>
      
      <Badge variant="outline" className={`font-mono text-xs ${priorityStyles[task.priority]}`}>{taskXp} XP</Badge>

      {canCarryForward && (
        <Button variant="ghost" size="icon" onClick={onCarryForward} className="h-8 w-8 text-blue-500 hover:text-blue-500 rounded-full" title="Carry forward to next day">
            <ChevronsRight className="h-4 w-4" />
        </Button>
      )}

      <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-black/60 hover:text-destructive hover:bg-destructive/10 rounded-full dark:text-slate-400 dark:hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
