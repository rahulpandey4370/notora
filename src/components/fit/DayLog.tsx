import { useState } from 'react';
import { Dumbbell, Flame, Footprints, Plus, Sparkles, Utensils, Watch, X } from 'lucide-react';
import type { Activity, AppData, Meal, MealSlot } from '@/lib/types';
import { MEAL_SLOTS, dayBurn, dayMacros, mealsBySlot, slotBudgets } from '@/lib/fitness';
import type { ItemRef } from './ItemSheet';

type Patch = Partial<Meal & Activity> | null;

function Row({ icon, title, detail, amount, tone, onOpen, onDelete }: {
  icon: React.ReactNode; title: string; detail?: string; amount: string; tone: 'in' | 'out' | 'muted'; onOpen: () => void; onDelete: () => void;
}) {
  return (
    <li className="f-row">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open ${title}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--f-tint)]">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          {detail && <span className="f-muted block truncate text-xs">{detail}</span>}
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
export function DayLog({ data, day, kcalGoal, onEdit, onOpen, onClearBurn, onAdd, onAiEdit }: {
  data: AppData; day: string; kcalGoal?: number;
  onEdit: (kind: 'meal' | 'activity', id: string, patch: Patch) => void; onOpen: (item: ItemRef) => void; onClearBurn: () => void; onAdd: (target: AddTarget) => void;
  /** Opens the Log it chat to change logged meals in words ("lunch was 2 bowls", "all had ghee"). */
  onAiEdit: () => void;
}) {
  const [tab, setTab] = useState<'food' | 'workouts'>('food');
  const fd = data.fitnessDays?.[day];
  const burn = dayBurn(data, day);
  const meals = fd?.meals ?? [];
  const totals = dayMacros(data, day); // same total as the calorie ring
  const kcalIn = totals.kcal;
  const groups = mealsBySlot(meals);
  const budgets = slotBudgets(kcalGoal);
  const fitbit = data.fitbitWorkouts?.[day] ?? [];
  const workoutCount = burn.activities.length + fitbit.length + (fd?.burnBase != null ? 1 : 0);
  const sum = (ms: Meal[]) => ms.reduce((s, m) => s + m.kcal, 0);
  const k = (n: number) => Math.round(n).toLocaleString('en-US');

  const g = (n?: number) => Math.round((n ?? 0) * 10) / 10;
  const macroLine = (m: Meal) => [`P ${g(m.proteinG)}`, m.carbsG ? `C ${g(m.carbsG)}` : '', m.fatG ? `F ${g(m.fatG)}` : '', m.fiberG ? `Fibre ${g(m.fiberG)}` : ''].filter(Boolean).join(' · ') + ' g';
  const mealRow = (m: Meal) => (
    <Row key={m.id} icon={<Utensils className="h-4 w-4 text-[var(--f-chart-a)]" />} title={m.name}
      detail={macroLine(m)} amount={`+${Math.round(m.kcal)}`} tone="in"
      onOpen={() => onOpen({ kind: 'meal', id: m.id })} onDelete={() => onEdit('meal', m.id, null)} />
  );
  const goal = kcalGoal ?? 0;
  const left = goal - kcalIn;

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
          <div className="px-4 pb-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">Today&apos;s calories</span>
              <span className="text-sm tabular-nums"><strong>{k(kcalIn)}</strong>{goal ? <span className="f-muted"> / {k(goal)} kcal</span> : <span className="f-muted"> kcal</span>}</span>
            </div>
            {goal > 0 && (
              <>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--f-tint)]" role="progressbar" aria-label="Calories eaten against today's target"
                  aria-valuemin={0} aria-valuemax={goal} aria-valuenow={kcalIn}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (kcalIn / goal) * 100)}%`, background: left < 0 ? 'var(--f-coral)' : 'var(--f-chart-a)' }} />
                </div>
                <p className={`mt-1 text-xs ${left < 0 ? 'f-bad font-semibold' : 'f-muted'}`}>{left >= 0 ? `${k(left)} kcal left` : `${k(-left)} kcal over`}</p>
              </>
            )}
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              {([['Protein', totals.proteinG], ['Carbs', totals.carbsG], ['Fat', totals.fatG], ['Fibre', totals.fiberG]] as const).map(([label, v]) => (
                <div key={label} className="rounded-xl bg-[var(--f-tint)] px-1 py-1.5">
                  <div className="text-sm font-semibold tabular-nums">{g(v)} g</div>
                  <div className="f-muted text-[11px]">{label}</div>
                </div>
              ))}
            </div>
            {meals.length > 0 && (
              <button type="button" className="f-pill mt-3 w-full" onClick={onAiEdit}>
                <Sparkles className="h-4 w-4" aria-hidden />Edit the food log with AI
              </button>
            )}
            {!budgets && <p className="f-muted mt-2 text-xs">Set a calorie target in Targets &amp; profile to see a budget for each meal.</p>}
          </div>
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
          {!meals.length && kcalIn > 0 && (
            <p className="f-muted border-t border-[var(--f-line)] px-4 py-3 text-xs">{k(kcalIn)} kcal was logged as a day total, without individual meals.</p>
          )}
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
                  onOpen={() => onOpen({ kind: 'activity', id: a.id })} onDelete={() => onEdit('activity', a.id, null)} />
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
