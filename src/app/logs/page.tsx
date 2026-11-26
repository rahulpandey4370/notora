'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
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

export default function LogsPage({ showcase = false }: LogsPageProps) {
  const router = useRouter();
  const { data, loading, user, handleDataChange } = useLogsPageData(showcase);

  useEffect(() => {
    if (!showcase && !loading && !user) router.push('/login');
  }, [user, loading, router, showcase]);

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
