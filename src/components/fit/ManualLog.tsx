import { useState } from 'react';
import { Check } from 'lucide-react';
import type { AppData } from '@/lib/types';
import { describeValueChange, type FitnessDraft } from '@/lib/fitness';

type Kind = 'meal' | 'workout' | 'number';
const LABEL: Record<Kind, string> = { meal: 'Meal', workout: 'Workout', number: 'Number' };
const num = (s: string) => { const n = Number(s); return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined; };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-1 flex-col gap-1 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}

/** No-AI logging: one meal, workout or tracker number at a time, saved straight away. */
export function ManualLog({ data, day, onSave }: { data: AppData; day: string; onSave: (d: FitnessDraft) => void }) {
  const [kind, setKind] = useState<Kind>('meal');
  const [f, setF] = useState({ name: '', a: '', b: '', tracker: data.logTrackers[0]?.id ?? '', stepBased: false });
  const [done, setDone] = useState('');
  const set = (p: Partial<typeof f>) => { setF(x => ({ ...x, ...p })); setDone(''); };
  const a = num(f.a), b = num(f.b);
  const tracker = data.logTrackers.find(t => t.id === f.tracker);
  const valid = kind === 'number' ? !!tracker && a != null && a > 0
    : !!f.name.trim() && a != null && (kind === 'meal' || b != null);

  const draftOf = (): FitnessDraft => {
    const d: FitnessDraft = { date: day, meals: [], activities: [], values: [] };
    if (kind === 'meal') d.meals.push({ name: f.name.trim(), kcal: a!, proteinG: b ?? 0 });
    else if (kind === 'workout') d.activities.push({ name: f.name.trim(), minutes: a!, kcal: b!, stepBased: f.stepBased });
    else d.values.push({ trackerId: f.tracker, value: a! });
    return d;
  };
  const note = kind === 'number' && valid ? describeValueChange(data, draftOf(), draftOf().values[0]) : null;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave(draftOf());
    setDone(`${kind === 'number' ? tracker!.name : f.name.trim()} saved ✓`);
    setF(x => ({ ...x, name: '', a: '', b: '', stepBased: false }));
  };
  const input = (key: 'name' | 'a' | 'b', placeholder: string, numeric = true) => (
    <input className="f-input" value={f[key]} placeholder={placeholder} onChange={e => set({ [key]: e.target.value })}
      {...(numeric ? { type: 'number', inputMode: 'decimal' as const, min: 0, step: 'any' } : { type: 'text' })} />
  );

  return (
    <form className="space-y-4" onSubmit={save}>
      <div className="flex gap-2" role="group" aria-label="What to log">
        {(Object.keys(LABEL) as Kind[]).map(k => (
          <button key={k} type="button" className="f-chip flex-1 justify-center" data-on={kind === k} aria-pressed={kind === k}
            onClick={() => { setKind(k); setDone(''); }}>{LABEL[k]}</button>
        ))}
      </div>
      {kind === 'meal' && <>
        <Field label="Food">{input('name', 'e.g. 2 rotis and dal', false)}</Field>
        <div className="flex gap-3"><Field label="Calories (kcal)">{input('a', '450')}</Field><Field label="Protein (g, optional)">{input('b', '15')}</Field></div>
      </>}
      {kind === 'workout' && <>
        <Field label="Activity">{input('name', 'e.g. Cycling', false)}</Field>
        <div className="flex gap-3"><Field label="Minutes">{input('a', '30')}</Field><Field label="Active kcal">{input('b', '250')}</Field></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[var(--f-deep)]" checked={f.stepBased} onChange={e => set({ stepBased: e.target.checked })} />
          Walk, run or hike (already counted in your steps)
        </label>
      </>}
      {kind === 'number' && <>
        <div className="flex gap-3">
          <Field label="Tracker">
            <select className="f-input" value={f.tracker} onChange={e => set({ tracker: e.target.value })}>
              {data.logTrackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label={tracker?.unit ? `Value (${tracker.unit})` : 'Value'}>{input('a', '')}</Field>
        </div>
        {note && <p className="f-muted text-xs">{note}</p>}
      </>}
      <button type="submit" className="f-pill f-pill-primary w-full" disabled={!valid}><Check className="h-4 w-4" aria-hidden />Save</button>
      <p className="f-good min-h-[1.25rem] text-center text-sm" aria-live="polite">{done}</p>
    </form>
  );
}
