'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import TaskList from '@/components/notora/TaskList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, loading: appLoading, handleDataChange } = useApp();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || appLoading || !data || !user) {
    return (
      <AppLayout>
        <div className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Skeleton className="h-80 w-full" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const tasksForSelectedDate = data.tasks.filter(task => {
    if (!selectedDate) return false;
    const taskDate = new Date(task.date);
    return taskDate.toDateString() === selectedDate.toDateString();
  });

  return (
    <AppLayout>
      <main className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 lg:sticky lg:top-24">
            <Card>
                <CardContent className="p-0">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="w-full"
                    />
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                <CardTitle>
                    Tasks for {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'a selected date'}
                </CardTitle>
                </CardHeader>
                <CardContent>
                    <TaskList 
                        tasks={tasksForSelectedDate} 
                        onDataChange={handleDataChange} 
                        data={data}
                        selectedDate={selectedDate || new Date()}
                    />
                </CardContent>
            </Card>
        </div>
      </main>
    </AppLayout>
  );
}
