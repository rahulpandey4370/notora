'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getAppData, saveAppData } from '@/lib/storage';
import type { AppData } from '@/lib/types';
import Dashboard from '@/components/notora/Dashboard';
import { v4 as uuidv4 } from 'uuid';
import { Skeleton } from '@/components/ui/skeleton';

const defaultAppData: AppData = {
  tasks: [],
  notes: [
    { 
      id: 'note-1', 
      content: 'Welcome to Notora! ✨\n\nThis is a draggable sticky note. You can edit me or use the AI tools in the menu below.', 
      position: { x: 50, y: 50 }, 
      theme: 'yellow' 
    },
  ],
  userStats: {
    xp: 0,
  },
};


export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (username: string) => {
    setLoading(true);
    let appData = await getAppData(username);
    if (!appData) {
      const newDefaultData = { ...defaultAppData, notes: [{...defaultAppData.notes[0], id: uuidv4()}] };
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
    return <LoadingSkeleton />;
  }

  return (
    <Dashboard 
      user={user} 
      data={data}
      onDataChange={handleDataChange}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </header>
      <main className="flex-1 p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
        <div className="lg:col-span-1 space-y-8">
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </main>
    </div>
  );
}
