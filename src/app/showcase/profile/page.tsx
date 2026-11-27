'use client';

import ProfileRoute from '@/app/profile/page';
import { ShowcaseProvider } from '@/contexts/showcase-context';

export default function ShowcaseProfilePage() {
  return (
    <ShowcaseProvider>
      <ProfileRoute showcase={true} />
    </ShowcaseProvider>
  );
}
