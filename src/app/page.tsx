'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import Dashboard from '@/components/notora/Dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { pageGate } from '@/lib/page-gate';
import LoadFailed from '@/components/notora/LoadFailed';
import AppLayout from '@/components/notora/AppLayout';
import Particles from '@/components/ui/particles';
import { useTheme } from 'next-themes';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { data, loading: appLoading, handleDataChange, loadFailed, retryLoad } = useApp();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // We only want to render this on the client after mount to avoid hydration errors
    // and only for the dark theme.
    setShowParticles(resolvedTheme === 'dark');
  }, [resolvedTheme]);


  // One named state for the page (lib/page-gate). 'failed' used to be a skeleton forever; the guard below keeps the types narrow.
  if (pageGate({ loading: authLoading || appLoading, user, data, loadFailed }).kind === 'failed') {
    return <AppLayout><LoadFailed onRetry={retryLoad} /></AppLayout>;
  }

  if (authLoading || appLoading || !data || !user) {
    return (
      <AppLayout>
        <LoadingSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {showParticles && (
         <Particles
            className="absolute inset-0 -z-10"
            quantity={200}
            particleCount={200}
            speed={0.1}
            particleBaseSize={1}
            particleSpread={10}
            alphaParticles={false}
         />
      )}
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
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
      </div>
       <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
