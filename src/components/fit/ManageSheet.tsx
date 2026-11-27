import { useState } from 'react';
import { Suspense } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import HealthConnectCard from '@/components/notora/HealthConnectCard';
import type { AppData, LogTracker } from '@/lib/types';
import { ConfirmDelete } from './TrackerSheet';

/** Create, edit and delete trackers, and connect Fitbit. */
export function ManageSheet({ open, onOpenChange, data, onDataChange, showcase }: {
  open: boolean; onOpenChange: (o: boolean) => void; data: AppData; onDataChange: (d: AppData) => void; showcase?: boolean;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [goal, setGoal] = useState('');

  const patch = (id: string, p: Partial<LogTracker>) =>
    onDataChange({ ...data, logTrackers: data.logTrackers.map(t => (t.id === id ? { ...t, ...p } : t)) });
  const add = () => {
    if (!name.trim() || !unit.trim()) return;
    const g = Number(goal);
    onDataChange({ ...data, logTrackers: [...data.logTrackers, { id: uuidv4(), name: name.trim(), unit: unit.trim(), goal: goal && Number.isFinite(g) ? g : undefined, logs: [] }] });
    setName(''); setUnit(''); setGoal('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="fit-ui f-sheet max-h-[calc((100dvh-var(--kb,0px))*0.92)] overflow-y-auto rounded-t-[28px] border-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 sm:mx-auto sm:max-w-lg">
        <SheetTitle className="fit-display text-2xl text-[var(--f-ink)]">Manage <em>trackers</em></SheetTitle>
        <SheetDescription className="f-muted text-sm">Rename, set goals, add new ones, or connect Fitbit.</SheetDescription>

        {!showcase && <div className="mt-4"><Suspense fallback={null}><HealthConnectCard /></Suspense></div>}

        <ul className="f-card mt-4 overflow-hidden">
          {data.logTrackers.map(t => (
            <li key={t.id} className="f-row flex-wrap">
              <label className="flex min-w-[8rem] flex-1 flex-col text-xs">
                <span className="f-muted">Name{t.healthMetric ? ' · Fitbit' : ''}</span>
                <input className="f-input mt-0.5 !py-1.5" defaultValue={t.name} onBlur={e => e.target.value.trim() && e.target.value.trim() !== t.name && patch(t.id, { name: e.target.value.trim() })} />
              </label>
              <label className="flex w-20 flex-col text-xs">
                <span className="f-muted">Unit</span>
                <input className="f-input mt-0.5 !py-1.5" defaultValue={t.unit} onBlur={e => e.target.value.trim() && e.target.value.trim() !== t.unit && patch(t.id, { unit: e.target.value.trim() })} />
              </label>
              <label className="flex w-24 flex-col text-xs">
                <span className="f-muted">Goal</span>
                <input className="f-input mt-0.5 !py-1.5" type="number" inputMode="decimal" step="any" defaultValue={t.goal ?? ''}
                  onBlur={e => { const v = e.target.value.trim(); const n = Number(v); const next = v === '' ? undefined : Number.isFinite(n) ? n : t.goal; if (next !== t.goal) patch(t.id, { goal: next }); }} />
              </label>
              <ConfirmDelete label="Delete" confirm={`Delete ${t.logs.length}?`} className="!min-h-11 !px-3 !text-xs"
                onConfirm={() => onDataChange({ ...data, logTrackers: data.logTrackers.filter(x => x.id !== t.id) })} />
            </li>
          ))}
        </ul>

        <div className="f-card mt-4 space-y-2 p-4">
          <p className="text-sm font-semibold">New tracker</p>
          <div className="flex flex-wrap gap-2">
            <input className="f-input min-w-[9rem] flex-1" placeholder="Name, e.g. Water" value={name} onChange={e => setName(e.target.value)} aria-label="Tracker name" />
            <input className="f-input w-24" placeholder="Unit, e.g. L" value={unit} onChange={e => setUnit(e.target.value)} aria-label="Unit" />
            <input className="f-input w-24" placeholder="Goal" type="number" inputMode="decimal" step="any" value={goal} onChange={e => setGoal(e.target.value)} aria-label="Goal (optional)" />
          </div>
          <button type="button" className="f-pill w-full" disabled={!name.trim() || !unit.trim()} onClick={add}><Plus className="h-4 w-4" aria-hidden />Add tracker</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
