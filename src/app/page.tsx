'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getAppData, saveAppData } from '@/lib/storage';
import type { AppData } from '@/lib/types';
import Dashboard from '@/components/notora/Dashboard';
import { v4 as uuidv4 } from 'uuid';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';

const defaultAppData: AppData = {
  tasks: [],
  noteBoards: [
    {
      id: 'board-1',
      title: 'General',
      notes: [
        { 
          id: 'note-1', 
          content: 'Welcome to Notora! ✨\n\nThis is a draggable sticky note. You can edit me or use the AI tools in the menu below.', 
          position: { x: 50, y: 50 }, 
          theme: 'yellow' 
        },
      ]
    }
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
      console.log(`No data found for ${username}, creating default data.`);
      const newDefaultData = { 
        ...defaultAppData, 
        noteBoards: [{
          ...defaultAppData.noteBoards[0], 
          id: uuidv4(),
          notes: [{...defaultAppData.noteBoards[0].notes[0], id: uuidv4()}] 
        }] 
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
    if (user) {
      setData(newData);
      saveAppData(user.username, newData);
    }
  };

  if (authLoading || loading || !data || !user) {
    return (
      <AppLayout user={user}>
        <LoadingSkeleton />
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user}>
      <Dashboard 
        user={user} 
        data={data}
        onDataChange={handleDataChange}
      />
    </AppLayout>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
       <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
