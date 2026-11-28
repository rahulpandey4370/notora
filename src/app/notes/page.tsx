
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from '@/hooks/use-app';
import { pageGate } from '@/lib/page-gate';
import LoadFailed from '@/components/notora/LoadFailed';
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
      loadFailed: false,
      retryLoad: undefined,
      user: showcaseData.demoUser,
      handleDataChange: showcaseData.handleDataChange,
    };
  }
  const appData = useApp();
  const auth = useAuth();
  return {
    data: appData.data,
    loading: auth.loading || appData.loading,
    loadFailed: appData.loadFailed,
    retryLoad: appData.retryLoad,
    user: auth.user,
    handleDataChange: appData.handleDataChange,
  };
}

export default function NotesPage({ showcase = false }: NotesPageProps) {
  const router = useRouter();
  const { data, loading, user, handleDataChange, loadFailed, retryLoad } = useNotesPageData(showcase);

  useEffect(() => {
    if (!showcase && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, showcase]);

  // One named state for the page (lib/page-gate). 'failed' used to be a skeleton forever; the guard below keeps the types narrow.
  if (pageGate({ loading, user: user, data, loadFailed }).kind === 'failed') {
    return <AppLayout data={data}><LoadFailed onRetry={retryLoad} /></AppLayout>;
  }

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
