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

    if (task.type === 'monthly') {
        return monthlyXp[task.priority];
    }
    return dailyXp[task.priority];
};
