'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { pageGate } from '@/lib/page-gate';
import LoadFailed from '@/components/notora/LoadFailed';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import { useShowcase } from '@/contexts/showcase-context';
import { FitnessPage } from '@/components/fit/FitnessPage';

interface LogsPageProps {
  showcase?: boolean;
}

function useLogsPageData(isShowcase: boolean) {
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

export default function LogsPage({ showcase = false }: LogsPageProps) {
  const router = useRouter();
  const { data, loading, user, handleDataChange, loadFailed, retryLoad } = useLogsPageData(showcase);

  useEffect(() => {
    if (!showcase && !loading && !user) router.push('/login');
  }, [user, loading, router, showcase]);

  // One named state for the page (lib/page-gate). 'failed' used to be a skeleton forever; the guard below keeps the types narrow.
  if (pageGate({ loading, user: showcase ? (user ?? true) : user, data, loadFailed }).kind === 'failed') {
    return <AppLayout data={data}><LoadFailed onRetry={retryLoad} /></AppLayout>;
  }

  if (loading || !data || (!showcase && !user)) {
    return (
      <AppLayout data={data}>
        <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
          <Skeleton className="h-96 w-full rounded-[26px]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48 w-full rounded-[22px]" />
            <Skeleton className="h-48 w-full rounded-[22px]" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data}>
      <FitnessPage data={data} onDataChange={handleDataChange} showcase={showcase} />
    </AppLayout>
  );
}
