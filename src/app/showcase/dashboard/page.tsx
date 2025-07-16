
'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { ShowcaseProvider, useShowcase } from '@/contexts/showcase-context';
import Dashboard from '@/components/notora/Dashboard';
import AppLayout from '@/components/notora/AppLayout';
import Particles from '@/components/ui/particles';
import { Skeleton } from '@/components/ui/skeleton';

// This is the main component that will be wrapped by the provider
function ShowcaseDashboardContent() {
  const { data, handleDataChange, demoUser } = useShowcase();
  const { resolvedTheme } = useTheme();
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    // We only want to render this on the client after mount to avoid hydration errors
    // and only for the dark theme.
    setShowParticles(resolvedTheme === 'dark');
  }, [resolvedTheme]);

  if (!data || !demoUser) {
    return (
      <AppLayout>
        <div className="p-4 md:p-8 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-96 rounded-lg" />
                <Skeleton className="h-96 rounded-lg" />
            </div>
            <Skeleton className="h-96 rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data}>
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
        user={demoUser}
        data={data}
        onDataChange={handleDataChange}
      />
    </AppLayout>
  );
}


// This is the page component that sets up the context providers
export default function ShowcaseDashboardPage() {
  return (
    <ShowcaseProvider>
      <ShowcaseDashboardContent />
    </ShowcaseProvider>
  );
}
