'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useApp } from '@/hooks/use-app';
import { cn } from '@/lib/utils';

/**
 * Persistence feedback.
 *
 * Every edit rewrites the whole document to the server, and until now a failed
 * write was completely invisible — the optimistic UI already showed the change,
 * so you could lose work and never know. This surfaces the actual state, and
 * stays quiet (renders nothing) when everything is fine and settled.
 */
export default function SaveIndicator() {
  const { saveState } = useApp();
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (saveState !== 'saved') return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 1800);
    return () => clearTimeout(t);
  }, [saveState]);

  if (saveState === 'idle') return null;
  if (saveState === 'saved' && !showSaved) return null;

  const isError = saveState === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors',
        isError
          ? 'text-destructive border-destructive/40 bg-destructive/10'
          : 'text-muted-foreground border-transparent'
      )}
      title={
        isError
          ? 'Your most recent change did not reach the server.'
          : saveState === 'saving'
            ? 'Saving your changes…'
            : 'All changes saved.'
      }
    >
      {saveState === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {saveState === 'saved' && <Cloud className="h-3.5 w-3.5" aria-hidden />}
      {isError && <CloudOff className="h-3.5 w-3.5" aria-hidden />}
      <span className="hidden sm:inline">
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Not saved'}
      </span>
    </div>
  );
}
