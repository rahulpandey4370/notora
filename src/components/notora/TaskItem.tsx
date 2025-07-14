'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { getTaskXp } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { motion, AnimatePresence } from 'framer-motion';

interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  isCompleted: boolean;
}

const priorityStyles = {
    Easy: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300",
    Medium: "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    Hard: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
}

export default function TaskItem({ task, onToggle, onDelete, isCompleted }: TaskItemProps) {
  const uniqueId = `task-${task.id}-${task.date || ''}`;
  const taskXp = getTaskXp(task);

  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex items-center gap-4 p-3 border-2 border-black rounded-lg bg-card hover:shadow-[4px_4px_0px_#000] transition-shadow"
    >
      <motion.div
        animate={{
          backgroundColor: isCompleted ? "hsl(var(--primary))" : "hsl(var(--card))",
          scale: isCompleted ? 1.05 : 1,
        }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-4 flex-1 rounded-md"
      >
        <Checkbox
          id={uniqueId}
          checked={isCompleted}
          onCheckedChange={onToggle}
          aria-labelledby={`${uniqueId}-label`}
          className="w-5 h-5 border-2 border-black rounded-sm data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
        <label
          id={`${uniqueId}-label`}
          htmlFor={uniqueId}
          className={`flex-1 text-sm font-medium cursor-pointer transition-colors ${isCompleted ? 'text-muted-foreground line-through' : ''}`}
        >
          {task.title}
        </label>
      </motion.div>
      
      <Badge variant="outline" className={`font-mono text-xs ${priorityStyles[task.priority]}`}>{taskXp} XP</Badge>

      <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-black/60 hover:text-destructive hover:bg-destructive/10 rounded-full">
        <Trash2 className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
