
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import { useShowcase } from '@/contexts/showcase-context';
import JournalManager from '@/components/notora/JournalManager';

interface JournalPageProps {
  showcase?: boolean;
}

function useJournalPageData(isShowcase: boolean) {
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

export default function JournalPage({ showcase = false }: JournalPageProps) {
  const router = useRouter();
  const { data, loading, user, handleDataChange } = useJournalPageData(showcase);
  
  useEffect(() => {
    if (!showcase && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, showcase]);

  if (loading || !data || !user) {
    return (
      <AppLayout data={data}>
        <div className="p-4 md:p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-8">
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
            <div className="lg:col-span-2 space-y-8">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data}>
        <JournalManager
            journalEntries={data.journalEntries || []}
            data={data}
            onDataChange={handleDataChange}
        />
    </AppLayout>
  );
}
