'use client';

import LogsPage from '@/app/logs/page';
import { ShowcaseProvider } from '@/contexts/showcase-context';

export default function ShowcaseLogsPage() {
  return (
    <ShowcaseProvider>
      <LogsPage showcase={true} />
    </ShowcaseProvider>
  );
}
