import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Task } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getTaskXp = (task: Task): number => {
    const dailyXp: Record<Task['priority'], number> = {
        Easy: 10,
        Medium: 25,
        Hard: 50,
    };
    const monthlyXp: Record<Task['priority'], number> = {
        Easy: 50,
        Medium: 100,
        Hard: 200,
    };

    if (task.type === 'monthly' || task.type === 'weekly') {
        return monthlyXp[task.priority];
    }

    if (task.originalXp && task.carryForwardCount && task.carryForwardCount > 0) {
        const penalty: Record<Task['priority'], number> = { Easy: 5, Medium: 10, Hard: 15 };
        return Math.max(0, task.originalXp - (penalty[task.priority] * task.carryForwardCount));
    }
    
    return dailyXp[task.priority];
};
