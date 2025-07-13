'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getAppData, saveAppData } from '@/lib/storage';
import type { AppData } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import TaskList from '@/components/notora/TaskList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const defaultAppData: AppData = {
  tasks: [],
  noteBoards: [],
  userStats: {
    xp: 0,
  },
};

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (username: string) => {
    setLoading(true);
    let appData = await getAppData(username);
    if (!appData) {
      const newDefaultData = { 
        ...defaultAppData, 
      };
      await saveAppData(username, newDefaultData);
      appData = newDefaultData;
    }
    setData(appData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        loadData(user.username);
      } else {
        router.push('/login');
      }
    }
  }, [user, authLoading, router, loadData]);

  const handleDataChange = (newData: AppData) => {
    setData(newData);
    if (user) {
      saveAppData(user.username, newData);
    }
  };

  if (authLoading || loading || !data || !user) {
    return (
      <AppLayout user={user}>
        <div className="p-4 md:p-8">
            <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <main className="p-4 md:p-8">
        <Card>
            <CardHeader>
            <CardTitle>My Tasks</CardTitle>
            </CardHeader>
            <CardContent>
            <TaskList tasks={data.tasks} onDataChange={handleDataChange} data={data} />
            </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}
