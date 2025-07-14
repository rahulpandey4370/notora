'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import Dashboard from '@/components/notora/Dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import Particles from '@/components/ui/particles';
import { useTheme } from 'next-themes';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { data, loading: appLoading, handleDataChange } = useApp();
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
            vy={-0.2}
            vx={-0.2}
            color="white"
            ease={20}
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
      <div className="flex justify-between items-center">
        <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[400px] lg:col-span-2 rounded-lg" />
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
