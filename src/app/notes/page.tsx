'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import NoteBoardsManager from '@/components/notora/NoteBoardsManager';

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, loading: appLoading, handleDataChange } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || appLoading || !data || !user) {
    return (
      <AppLayout>
        <div className="p-4 md:p-8 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <NoteBoardsManager
        noteBoards={data.noteBoards}
        data={data}
        onDataChange={handleDataChange}
      />
    </AppLayout>
  );
}
