'use client';

import JournalPage from '@/app/journal/page';
import { ShowcaseProvider } from '@/contexts/showcase-context';

export default function ShowcaseJournalPage() {
  return (
    <ShowcaseProvider>
      <JournalPage showcase={true} />
    </ShowcaseProvider>
  );
}
