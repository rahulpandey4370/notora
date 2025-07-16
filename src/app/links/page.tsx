
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import LinkManager from '@/components/notora/LinkManager';
import { useShowcase } from '@/contexts/showcase-context';

interface LinksPageProps {
  showcase?: boolean;
}

export default function LinksPage({ showcase = false }: LinksPageProps) {
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
