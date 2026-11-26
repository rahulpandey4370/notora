import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import LogTrackerCard from '@/components/notora/LogTrackerCard';
import type { LogTracker } from '@/lib/types';

/** Full tracker card (30-day chart, insights, all logs) in a bottom sheet. */
export function TrackerSheet({ tracker, onClose, onChange, onDelete }: {
  tracker: LogTracker | null; onClose: () => void; onChange: (patch: Partial<LogTracker>) => void; onDelete: () => void;
}) {
  return (
    <Sheet open={!!tracker} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] p-3 pt-8 sm:mx-auto sm:max-w-3xl">
        <SheetTitle className="sr-only">{tracker?.name ?? 'Tracker'}</SheetTitle>
        {tracker && <LogTrackerCard tracker={tracker} cardIndex={0} onDelete={onDelete} onTrackerChange={onChange} />}
      </SheetContent>
    </Sheet>
  );
}
