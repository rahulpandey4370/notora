import { useEffect, useState } from 'react';
import { Check, Dumbbell, Flame, Footprints, Utensils, X } from 'lucide-react';
import type { Activity, AppData, Meal } from '@/lib/types';
import { dayBurn } from '@/lib/fitness';

type Patch = Partial<Meal & Activity> | null;

function Row({ icon, title, detail, amount, tone, editing, onEdit, onCancel, onSave, onDelete, fields }: {
  icon: React.ReactNode; title: string; detail?: string; amount: string; tone: 'in' | 'out' | 'muted';
  editing: boolean; onEdit: () => void; onCancel: () => void; onSave: (p: Record<string, number | string>) => void; onDelete: () => void;
  fields: { key: string; label: string; value: number | string; type: 'number' | 'text' }[];
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => { if (!editing) setDraft({}); }, [editing]); // an abandoned edit must not be saved later
  if (editing) {
    return (
      <li className="f-row flex-wrap">
        {fields.map(f => (
          <label key={f.key} className={`flex flex-col text-xs ${f.type === 'text' ? 'min-w-[9rem] flex-1' : 'w-20'}`}>
            <span className="f-muted">{f.label}</span>
            <input className="f-input mt-0.5 !py-1.5" type={f.type} inputMode={f.type === 'number' ? 'decimal' : undefined} step={f.type === 'number' ? 'any' : undefined}
              defaultValue={String(f.value)} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))} />
          </label>
        ))}
        <button type="button" className="f-icon-btn h-11 w-11" aria-label="Save changes"
          onClick={() => {
            const patch: Record<string, number | string> = {};
            for (const [k, v] of Object.entries(draft)) {
              const isNum = fields.find(f => f.key === k)?.type === 'number';
              if (isNum ? v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 : v.trim()) patch[k] = isNum ? Number(v) : v.trim();
            }
            setDraft({});
            onSave(patch);
          }}>
          <Check className="h-4 w-4" />
        </button>
        <button type="button" className="f-icon-btn h-11 w-11" aria-label="Cancel editing" onClick={onCancel}><X className="h-4 w-4" /></button>
      </li>
    );
  }
  return (
    <li className="f-row">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Edit ${title}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--f-tint)]">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          {detail && <span className="f-muted block text-xs">{detail}</span>}
        </span>
      </button>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${tone === 'in' ? '' : tone === 'out' ? 'f-good' : 'f-muted'}`}>{amount}</span>
      <button type="button" className="f-muted -mr-2 flex h-11 w-11 shrink-0 items-center justify-center" aria-label={`Delete ${title}`} onClick={onDelete}>
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

/** The picked day's meals and workouts; tap to edit numbers, × to delete. */
export function DayLog({ data, day, onEdit, onClearBurn }: {
  data: AppData; day: string; onEdit: (kind: 'meal' | 'activity', id: string, patch: Patch) => void; onClearBurn: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const fd = data.fitnessDays?.[day];
  const burn = dayBurn(data, day);
  const meals = fd?.meals ?? [];
  const kcalIn = meals.reduce((s, m) => s + m.kcal, 0);

  return (
    <section className="f-card overflow-hidden" aria-label="Meals and workouts">
      <div className="flex items-baseline justify-between px-4 pt-4">
        <h2 className="fit-display text-2xl">Meals &amp; <em>workouts</em></h2>
        {meals.length > 0 && <span className="f-muted text-sm tabular-nums">{kcalIn.toLocaleString('en-US')} kcal in</span>}
      </div>
      {!meals.length && !burn.activities.length && fd?.burnBase == null ? (
        <p className="f-muted px-4 pb-5 pt-2 text-sm">Nothing logged yet. Tap ✏️, 🎙 or 📷 above to add a meal or workout.</p>
      ) : (
        <ul className="mt-2">
          {meals.map(m => (
            <Row key={m.id} icon={<Utensils className="h-4 w-4 text-[var(--f-chart-a)]" />} title={m.name}
              detail={m.proteinG ? `${Math.round(m.proteinG)} g protein` : undefined} amount={`+${Math.round(m.kcal)}`} tone="in"
              editing={editing === m.id} onEdit={() => setEditing(m.id)} onCancel={() => setEditing(null)} onDelete={() => onEdit('meal', m.id, null)}
              onSave={p => { onEdit('meal', m.id, p as Patch); setEditing(null); }}
              fields={[{ key: 'name', label: 'Item', value: m.name, type: 'text' }, { key: 'kcal', label: 'kcal', value: m.kcal, type: 'number' }, { key: 'proteinG', label: 'Protein g', value: m.proteinG, type: 'number' }]} />
          ))}
          {burn.activities.map(({ activity: a, counted }) => (
            <Row key={a.id} icon={a.stepBased ? <Footprints className="h-4 w-4 text-[var(--f-chart-b)]" /> : <Dumbbell className="h-4 w-4 text-[var(--f-chart-b)]" />}
              title={a.name} detail={`${Math.round(a.minutes)} min${counted ? '' : burn.source === 'fitbit' ? ' · in your Fitbit burn' : ' · counted in your steps'}`}
              amount={counted ? `−${Math.round(a.kcal)}` : `${Math.round(a.kcal)}`} tone={counted ? 'out' : 'muted'}
              editing={editing === a.id} onEdit={() => setEditing(a.id)} onCancel={() => setEditing(null)} onDelete={() => onEdit('activity', a.id, null)}
              onSave={p => { onEdit('activity', a.id, p as Patch); setEditing(null); }}
              fields={[{ key: 'name', label: 'Activity', value: a.name, type: 'text' }, { key: 'minutes', label: 'Minutes', value: a.minutes, type: 'number' }, { key: 'kcal', label: 'kcal', value: a.kcal, type: 'number' }]} />
          ))}
          {fd?.burnBase != null && (
            <li className="f-row">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--f-tint)]"><Flame className="h-4 w-4 text-[var(--f-chart-b)]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Day burn total</span>
                <span className="f-muted block text-xs">Typed or earlier total. Delete it to use your estimate.</span>
              </span>
              <span className="f-muted shrink-0 text-sm font-semibold tabular-nums">{Math.round(fd.burnBase).toLocaleString('en-US')}</span>
              <button type="button" className="f-muted -mr-2 flex h-11 w-11 shrink-0 items-center justify-center" aria-label="Delete the day burn total" onClick={onClearBurn}>
                <X className="h-4 w-4" />
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
