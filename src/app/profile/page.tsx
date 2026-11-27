'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApp } from '@/hooks/use-app';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/notora/AppLayout';
import { useShowcase } from '@/contexts/showcase-context';
import { ProfilePage } from '@/components/fit/ProfilePage';

interface ProfileRouteProps {
  showcase?: boolean;
}

/** Same data wiring as the Logs page: the signed-in user's data, or the showcase's demo data. */
function useProfileData(isShowcase: boolean) {
  if (isShowcase) {
    const s = useShowcase();
    return { data: s.data, loading: !s.data, user: s.demoUser, handleDataChange: s.handleDataChange, logout: undefined };
  }
  const app = useApp();
  const auth = useAuth();
  return { data: app.data, loading: auth.loading || app.loading, user: auth.user, handleDataChange: app.handleDataChange, logout: auth.logout };
}

export default function ProfileRoute({ showcase = false }: ProfileRouteProps) {
  const router = useRouter();
  const { data, loading, user, handleDataChange, logout } = useProfileData(showcase);

  useEffect(() => {
    if (!showcase && !loading && !user) router.push('/login');
  }, [user, loading, router, showcase]);

  if (loading || !data || !user) {
    return (
      <AppLayout data={data}>
        <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
          <Skeleton className="h-28 w-full rounded-[26px]" />
          <Skeleton className="h-96 w-full rounded-[22px]" />
        </div>
      </AppLayout>
    );
  }
  return (
    <AppLayout data={data}>
      <ProfilePage data={data} onDataChange={handleDataChange} user={user} onLogout={logout} showcase={showcase} />
    </AppLayout>
  );
}
