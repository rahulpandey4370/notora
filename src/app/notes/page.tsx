
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import NoteBoardsManager from '@/components/notora/NoteBoardsManager';
import { useShowcase } from '@/contexts/showcase-context';

interface NotesPageProps {
  showcase?: boolean;
}

export default function NotesPage({ showcase = false }: NotesPageProps) {
  const router = useRouter();
  
  // Conditional hooks
  const { user, loading: authLoading } = useAuth();
  const appData = useApp();
  const showcaseData = useShowcase();

  const { data, loading: appLoading, handleDataChange } = showcase ? showcaseData : appData;
  const currentUser = showcase ? showcaseData.demoUser : user;

  useEffect(() => {
    if (!showcase && !authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router, showcase]);

  if (authLoading || appLoading || !data || !currentUser) {
    return (
      <AppLayout data={data}>
        <div className="p-4 md:p-8 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data}>
      <NoteBoardsManager
        noteBoards={data.noteBoards}
        data={data}
        onDataChange={handleDataChange}
      />
    </AppLayout>
  );
}
