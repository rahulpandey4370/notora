import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { AppData, FitnessProfile } from '@/lib/types';
import { findTracker, setTargets, suggestTargets } from '@/lib/fitness';

type Form = { sex: 'male' | 'female'; age: string; height: string; weightGoal: string; kcal: string; protein: string; steps: string };
const str = (n: number | null | undefined) => (n == null ? '' : String(n));
const num = (s: string) => { const n = Number(s); return s.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined; };

/** Age/sex/height and the four targets. Suggestions pre-fill empty goals. */
export function TargetsSheet({ open, onOpenChange, data, today, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; data: AppData; today: string; onSave: (next: AppData) => void;
}) {
  const [f, setF] = useState<Form | null>(null);

  useEffect(() => {
    if (!open) return;
    const year = Number(today.slice(0, 4));
    let p: Partial<FitnessProfile> = data.fitnessProfile ?? {};
    if (!data.fitnessProfile) {
      // One-time import of the old AI Calorie Coach stats (they lived in this browser only).
      try {
        const old = JSON.parse(localStorage.getItem('notora-user-stats') || 'null');
        if (old) p = { sex: old.gender === 'female' ? 'female' : 'male', birthYear: old.age ? year - Number(old.age) : undefined, heightCm: Number(old.height) || undefined };
      } catch { /* storage unavailable: start empty */ }
    }
    const s = suggestTargets({ ...data, fitnessProfile: data.fitnessProfile ?? (p.birthYear && p.heightCm ? (p as FitnessProfile) : undefined) }, today);
    setF({
      sex: p.sex ?? 'male',
      age: p.birthYear ? String(year - p.birthYear) : '',
      height: str(p.heightCm),
      weightGoal: str(findTracker(data, 'weight')?.goal),
      kcal: str(findTracker(data, 'intake')?.goal ?? s.kcal),
      protein: str(findTracker(data, 'protein')?.goal ?? s.proteinG),
      steps: str(findTracker(data, 'steps')?.goal ?? s.steps),
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const age = f ? num(f.age) : undefined, height = f ? num(f.height) : undefined;
  const valid = !!f && age != null && age >= 10 && age <= 110 && height != null && height >= 100 && height <= 250;
  const save = () => {
    if (!f || !valid) return;
    const profile: FitnessProfile = { sex: f.sex, birthYear: Number(today.slice(0, 4)) - age!, heightCm: height! };
    onSave(setTargets(data, profile, { weight: num(f.weightGoal), intake: num(f.kcal), protein: num(f.protein), steps: num(f.steps) }, uuidv4));
    onOpenChange(false);
  };
  const field = (key: keyof Form, label: string, unit: string, hint?: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input className="f-input" type="number" inputMode="decimal" min={0} value={f?.[key] ?? ''} onChange={e => setF(x => x && { ...x, [key]: e.target.value })} />
        <span className="f-muted w-12 text-xs">{unit}</span>
      </span>
      {hint && <span className="f-muted text-xs">{hint}</span>}
    </label>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="fit-ui f-sheet max-h-[92dvh] overflow-y-auto rounded-t-[28px] border-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 sm:mx-auto sm:max-w-lg">
        <SheetTitle className="fit-display text-2xl text-[var(--f-ink)]">Targets &amp; <em>you</em></SheetTitle>
        <SheetDescription className="f-muted text-sm">Used for your burn estimate and the rings. Synced to all your devices.</SheetDescription>
        {f && (
          <div className="mt-4 space-y-5">
            <fieldset className="space-y-3">
              <legend className="f-muted mb-1 text-xs font-semibold uppercase tracking-wide">About you</legend>
              <div className="flex gap-2" role="group" aria-label="Sex (for the BMR formula)">
                {(['male', 'female'] as const).map(s => (
                  <button key={s} type="button" aria-pressed={f.sex === s} className="f-chip flex-1 justify-center" data-on={f.sex === s}
                    onClick={() => setF({ ...f, sex: s })}>{s === 'male' ? 'Male' : 'Female'}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">{field('age', 'Age', 'years')}{field('height', 'Height', 'cm')}</div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="f-muted mb-1 text-xs font-semibold uppercase tracking-wide">Daily targets</legend>
              {field('weightGoal', 'Weight goal', 'kg')}
              {field('kcal', 'Calories', 'kcal', 'Suggested: your recent average burn minus 500.')}
              {field('protein', 'Protein', 'g', 'Suggested: 1.6 g per kg of body weight.')}
              {field('steps', 'Steps', 'steps')}
            </fieldset>
            {!valid && <p className="f-bad text-xs">Enter your age and height to save.</p>}
            <button type="button" className="f-pill f-pill-primary w-full" disabled={!valid} onClick={save}>Save</button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
