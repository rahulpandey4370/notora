'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Edit } from "lucide-react";
import type { Task } from "@/lib/types";

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  // onEdit: (id: string) => void; // Future enhancement
}

const priorityVariant: Record<Task['priority'], 'default' | 'secondary' | 'destructive'> = {
  'Easy': 'secondary',
  'Medium': 'default',
  'Hard': 'destructive'
}

const priorityBadge: Record<Task['priority'], string> = {
    'Easy': 'bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/30',
    'Medium': 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30 hover:bg-yellow-500/30',
    'Hard': 'bg-red-500/20 text-red-700 border-red-500/30 hover:bg-red-500/30',
}

export default function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  return (
    <div className="flex items-center gap-4 p-2 rounded-md hover:bg-secondary/50 transition-colors">
      <Checkbox
        id={`task-${task.id}`}
        checked={task.completed}
        onCheckedChange={() => onToggle(task.id)}
        aria-labelledby={`task-label-${task.id}`}
      />
      <label
        id={`task-label-${task.id}`}
        className={`flex-1 text-sm ${task.completed ? 'text-muted-foreground line-through' : ''}`}
      >
        {task.title}
      </label>
      <Badge variant="outline" className={priorityBadge[task.priority]}>
        {task.priority}
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* <DropdownMenuItem onClick={() => onEdit(task.id)}>
            <Edit className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem> */}
          <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
