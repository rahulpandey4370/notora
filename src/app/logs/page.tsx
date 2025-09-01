
'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import { useShowcase } from '@/contexts/showcase-context';
import LogManager from '@/components/notora/LogManager';
import AICalorieCoach from '@/components/notora/AICalorieCoach';
import type { Task, LogEntry, AppData } from '@/lib/types';
import { format, startOfDay, subDays } from 'date-fns';

interface LogsPageProps {
  showcase?: boolean;
}

function useLogsPageData(isShowcase: boolean) {
  if (isShowcase) {
    const showcaseData = useShowcase();
    return {
      data: showcaseData.data,
      loading: !showcaseData.data,
      user: showcaseData.demoUser,
      handleDataChange: showcaseData.handleDataChange,
    };
  }
  const appData = useApp();
  const auth = useAuth();
  return {
    data: appData.data,
    loading: auth.loading || appData.loading,
    user: auth.user,
    handleDataChange: appData.handleDataChange,
  };
}

export default function LogsPage({ showcase = false }: LogsPageProps) {
  const router = useRouter();
  const { data, loading, user, handleDataChange } = useLogsPageData(showcase);
  
  useEffect(() => {
    if (!showcase && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, showcase]);
  
  const getCompletedTasksForDate = (date: Date): Task[] => {
    if (!data) return [];
    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
    return data.tasks.filter(task => (task.completions || []).includes(dateStr));
  };

  const getCalorieIntakeForDate = (date: Date): number | undefined => {
    if (!data) return undefined;
    const calorieTracker = data.logTrackers.find(t => t.name === 'Daily Calorie Intake');
    if (!calorieTracker) return undefined;
    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
    const log = calorieTracker.logs.find(l => l.date === dateStr);
    return log?.value;
  };
  
  const getStepsForDate = (date: Date): number | undefined => {
    if (!data) return undefined;
    const stepsTracker = data.logTrackers.find(t => t.name === 'Steps');
    if (!stepsTracker) return undefined;
    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
    const log = stepsTracker.logs.find(l => l.date === dateStr);
    return log?.value;
  };
  
  const weeklyChartData = useMemo(() => {
    if (!data) return [];
    const intakeTracker = data.logTrackers.find(t => t.name === 'Daily Calorie Intake');
    const burnedTracker = data.logTrackers.find(t => t.name === 'Calories Burned');
    
    const today = startOfDay(new Date());
    
    return Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const intakeLog = intakeTracker?.logs.find(l => l.date === dateStr);
        const burnedLog = burnedTracker?.logs.find(l => l.date === dateStr);

        return {
            date: dateStr,
            intake: intakeLog?.value,
            burned: burnedLog?.value,
        };
    }).reverse();
  }, [data]);


  if (loading || !data || !user) {
    return (
      <AppLayout data={data}>
        <div className="p-4 md:p-8 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data}>
      <div className="p-4 md:p-8 space-y-6">
        <AICalorieCoach 
            getCompletedTasksForDate={getCompletedTasksForDate}
            getCalorieIntakeForDate={getCalorieIntakeForDate}
            getStepsForDate={getStepsForDate}
            weeklyChartData={weeklyChartData}
        />
        <LogManager
          logTrackers={data.logTrackers || []}
          data={data}
          onDataChange={handleDataChange}
        />
      </div>
    </AppLayout>
  );
}
