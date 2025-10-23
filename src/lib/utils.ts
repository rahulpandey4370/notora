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

export const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);
export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const endOfWeek = (date: Date) => {
    const weekStart = startOfWeek(date);
    return new Date(weekStart.setDate(weekStart.getDate() + 6));
}
export const startOfWeek = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(new Date(date).setDate(diff));
}
