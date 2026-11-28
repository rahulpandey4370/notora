
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { pageGate } from '@/lib/page-gate';
import LoadFailed from '@/components/notora/LoadFailed';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import LinkManager from '@/components/notora/LinkManager';
import { useShowcase } from '@/contexts/showcase-context';
import type { AppData, User } from '@/lib/types';

interface LinksPageProps {
  showcase?: boolean;
}

function useLinksPageData(isShowcase: boolean) {
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

export default function LinksPage({ showcase = false }: LinksPageProps) {
  const router = useRouter();
  const { data, loading, user, handleDataChange, loadFailed, retryLoad } = useLinksPageData(showcase);
  
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
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data}>
      <LinkManager
        savedLinks={data.savedLinks || []}
        data={data}
        onDataChange={handleDataChange}
      />
    </AppLayout>
  );
}
