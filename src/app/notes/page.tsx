
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

function useNotesPageData(isShowcase: boolean) {
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

export default function NotesPage({ showcase = false }: NotesPageProps) {
  const router = useRouter();
  const { data, loading, user, handleDataChange } = useNotesPageData(showcase);

  useEffect(() => {
    if (!showcase && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, showcase]);

  if (loading || !data || !user) {
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
