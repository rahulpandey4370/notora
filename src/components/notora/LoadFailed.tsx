'use client';

import { Button } from '@/components/ui/button';

/** Shown when the workspace couldn't be loaded and there is no cached copy to show (page-gate 'failed'). */
export default function LoadFailed({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <h2 className="text-lg font-semibold">Couldn&apos;t load your workspace</h2>
      <p className="text-sm text-muted-foreground">Check your connection, then try again. Nothing has been lost: your data is on the server.</p>
      {onRetry && <Button className="h-11 px-6" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
