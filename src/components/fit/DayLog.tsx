import { useEffect, useState } from 'react';
import { Check, Dumbbell, Flame, Footprints, Plus, Utensils, Watch, X } from 'lucide-react';
import type { Activity, AppData, Meal, MealSlot } from '@/lib/types';
import { MEAL_SLOTS, dayBurn, mealsBySlot, slotBudgets } from '@/lib/fitness';

type Patch = Partial<Meal & Activity> | null;

function Row({ icon, title, detail, amount, tone, editing, onEdit, onCancel, onSave, onDelete, fields }: {
  icon: React.ReactNode; title: string; detail?: string; amount: string; tone: 'in' | 'out' | 'muted';
  editing: boolean; onEdit: () => void; onCancel: () => void; onSave: (p: Record<string, number | string>) => void; onDelete: () => void;
  fields: { key: string; label: string; value: number | string; type: 'number' | 'text' | 'select'; options?: { value: string; label: string }[] }[];
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => { if (!editing) setDraft({}); }, [editing]); // an abandoned edit must not be saved later
  if (editing) {
    return (
      <li className="f-row flex-wrap">
        {fields.map(f => f.type === 'select' ? (
          <label key={f.key} className="flex w-36 flex-col text-xs">
            <span className="f-muted">{f.label}</span>
            <select className="f-input mt-0.5 !py-1.5" defaultValue={String(f.value)} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}>
              {!f.value && <option value="">Choose…</option>}
              {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        ) : (
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

export type AddTarget = { kind: 'meal'; slot: MealSlot } | { kind: 'workout' };

/** The picked day's log in two tabs: Food (five sections with calorie budgets) and Workouts. Tap a row to edit, × to delete. */
export function DayLog({ data, day, kcalGoal, onEdit, onClearBurn, onAdd }: {
  data: AppData; day: string; kcalGoal?: number;
  onEdit: (kind: 'meal' | 'activity', id: string, patch: Patch) => void; onClearBurn: () => void; onAdd: (target: AddTarget) => void;
}) {
  const [tab, setTab] = useState<'food' | 'workouts'>('food');
  const [editing, setEditing] = useState<string | null>(null);
  const fd = data.fitnessDays?.[day];
  const burn = dayBurn(data, day);
  const meals = fd?.meals ?? [];
  const kcalIn = meals.reduce((s, m) => s + m.kcal, 0);
  const groups = mealsBySlot(meals);
  const budgets = slotBudgets(kcalGoal);
  const fitbit = data.fitbitWorkouts?.[day] ?? [];
  const workoutCount = burn.activities.length + fitbit.length + (fd?.burnBase != null ? 1 : 0);
  const sum = (ms: Meal[]) => ms.reduce((s, m) => s + m.kcal, 0);
  const k = (n: number) => Math.round(n).toLocaleString('en-US');

  const mealRow = (m: Meal) => (
    <Row key={m.id} icon={<Utensils className="h-4 w-4 text-[var(--f-chart-a)]" />} title={m.name}
      detail={m.proteinG ? `${Math.round(m.proteinG)} g protein` : undefined} amount={`+${Math.round(m.kcal)}`} tone="in"
      editing={editing === m.id} onEdit={() => setEditing(m.id)} onCancel={() => setEditing(null)} onDelete={() => onEdit('meal', m.id, null)}
      onSave={p => { onEdit('meal', m.id, p as Patch); setEditing(null); }}
      fields={[{ key: 'name', label: 'Item', value: m.name, type: 'text' }, { key: 'kcal', label: 'kcal', value: m.kcal, type: 'number' }, { key: 'proteinG', label: 'Protein g', value: m.proteinG, type: 'number' },
        { key: 'slot', label: 'Meal', value: m.slot ?? '', type: 'select', options: MEAL_SLOTS.map(x => ({ value: x.id, label: x.label })) }]} />
  );

  return (
    <section className="f-card overflow-hidden" aria-label="Food and workout log">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h2 className="fit-display text-2xl">The <em>log</em></h2>
        <div className="flex gap-1.5" role="tablist" aria-label="Log">
          <button type="button" role="tab" aria-selected={tab === 'food'} className="f-chip" data-on={tab === 'food'} onClick={() => setTab('food')}>
            <Utensils className="h-3.5 w-3.5" aria-hidden />Food{meals.length ? ` · ${k(kcalIn)} kcal` : ''}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'workouts'} className="f-chip" data-on={tab === 'workouts'} onClick={() => setTab('workouts')}>
            <Dumbbell className="h-3.5 w-3.5" aria-hidden />Workouts{workoutCount ? ` · ${workoutCount}` : ''}
          </button>
        </div>
      </div>

      {tab === 'food' ? (
        <div className="mt-2 pb-2" role="tabpanel" aria-label="Food">
          {!budgets && <p className="f-muted px-4 pb-1 text-xs">Set a calorie target in Targets &amp; profile to see a budget for each meal.</p>}
          {MEAL_SLOTS.map(({ id, label }) => {
            const eaten = sum(groups[id]);
            const budget = budgets?.[id];
            const over = budget != null && eaten > budget;
            return (
              <div key={id} className="border-t border-[var(--f-line)] first:border-t-0">
                <div className="flex items-center gap-3 px-4 pb-1 pt-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold">{label}</h3>
                      <span className={`text-xs tabular-nums ${over ? 'f-bad font-semibold' : 'f-muted'}`}>
                        {k(eaten)}{budget != null ? ` / ${k(budget)}` : ''} kcal
                      </span>
                    </div>
                    {budget != null && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--f-tint)]" aria-hidden>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (eaten / budget) * 100)}%`, background: over ? 'var(--f-coral)' : 'var(--f-chart-a)' }} />
                      </div>
                    )}
                  </div>
                  <button type="button" className="f-icon-btn h-9 w-9 shrink-0" aria-label={`Add to ${label}`} onClick={() => onAdd({ kind: 'meal', slot: id })}><Plus className="h-4 w-4" /></button>
                </div>
                {groups[id].length > 0 && <ul>{groups[id].map(mealRow)}</ul>}
              </div>
            );
          })}
          {groups.other.length > 0 && (
            <div className="border-t border-[var(--f-line)]">
              <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
                <h3 className="text-sm font-semibold">Other</h3>
                <span className="f-muted text-xs tabular-nums">{k(sum(groups.other))} kcal · tap one to move it to a meal</span>
              </div>
              <ul>{groups.other.map(mealRow)}</ul>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2" role="tabpanel" aria-label="Workouts">
          {!workoutCount ? (
            <p className="f-muted px-4 pb-2 pt-1 text-sm">No workouts logged. Walks and runs are already in your steps{burn.source === 'fitbit' ? ' and Fitbit burn' : ''}.</p>
          ) : (
            <ul>
              {fitbit.map(w => (
                <li key={w.id} className="f-row">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--f-tint)]"><Watch className="h-4 w-4 text-[var(--f-chart-b)]" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{w.name}</span>
                    <span className="f-muted block text-xs">
                      {[w.start, `${w.minutes} min`, w.distanceKm ? `${w.distanceKm} km` : '', w.avgHr ? `avg ${w.avgHr} bpm` : '', 'Fitbit'].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="f-muted shrink-0 text-sm font-semibold tabular-nums" title="Already in your Fitbit burn">{w.kcal}</span>
                </li>
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
          <div className="px-4 pb-4 pt-2">
            <button type="button" className="f-pill w-full" onClick={() => onAdd({ kind: 'workout' })}><Plus className="h-4 w-4" aria-hidden />Add a workout</button>
          </div>
        </div>
      )}
    </section>
  );
}
