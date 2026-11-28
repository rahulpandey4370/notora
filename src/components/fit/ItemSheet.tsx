import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { Activity, AppData, Meal, MealSlot } from '@/lib/types';
import { useModelFor, useModelStore } from '@/hooks/use-model-store';
import { MEAL_SLOTS, type FitnessDraft } from '@/lib/fitness';
import { parseFitnessLog } from '@/ai/flows/parse-fitness-log';
import { AutoTextarea } from './AutoTextarea';
import { QtyMeasure } from './FoodsPanel';
import type { FoodsApi } from './useFoods';
import { amountOf, measuresFor, openMealAmount, rescaleMeal, savedMealName, scaleFood, type Food, type MealAmount } from '@/lib/food-match';

export type ItemRef = { kind: 'meal' | 'activity'; id: string };
type Form = Record<'name' | 'notes' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'minutes', string> & { slot: MealSlot | ''; stepBased: boolean };
const str = (n?: number) => (n == null || n === 0 ? '' : String(Math.round(n * 10) / 10));
const num = (s: string) => { const n = Number(s); return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : 0; };
const toForm = (m?: Meal, a?: Activity): Form => ({
  name: m?.name ?? a?.name ?? '', notes: m?.notes ?? a?.notes ?? '', slot: m?.slot ?? '',
  kcal: str(m?.kcal ?? a?.kcal), proteinG: str(m?.proteinG), carbsG: str(m?.carbsG), fatG: str(m?.fatG), fiberG: str(m?.fiberG),
  minutes: str(a?.minutes), stepBased: !!a?.stepBased,
});

/** Full detail of one logged meal or workout: every number editable, plus "edit with AI". Nothing saves until Save. */
export function ItemSheet({ item, data, day, today, onClose, onSave, onDelete, onReplace, aiDisabled, foods }: {
  item: ItemRef | null; data: AppData; day: string; today: string; onClose: () => void;
  onSave: (item: ItemRef, patch: Partial<Meal & Activity>) => void; onDelete: (item: ItemRef) => void;
  /** The AI split one meal into several: replace it with these. */
  onReplace: (item: ItemRef, draft: FitnessDraft) => void; aiDisabled?: boolean;
  /** My Foods and the catalogue: a meal logged from one of them re-scales from that food when its amount changes. */
  foods?: FoodsApi;
}) {
  const { webSearch } = useModelStore();
  const selectedModel = useModelFor('food');
  const fd = data.fitnessDays?.[day];
  const meal = item?.kind === 'meal' ? fd?.meals.find(m => m.id === item.id) : undefined;
  const act = item?.kind === 'activity' ? fd?.activities.find(a => a.id === item.id) : undefined;
  const [f, setF] = useState<Form>(toForm());
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [split, setSplit] = useState<FitnessDraft | null>(null);

  // A meal's amount lives in Quantity + Measure, never in the Food field: the name is shown without it and put back on save.
  // The rules (when a meal still follows its food, how the amount is read off a name, what name is saved) are in
  // lib/food-match: openMealAmount / savedMealName. `base` holds the numbers that get scaled when there is no food to follow.
  const linked = meal?.foodId && foods ? [...foods.foods, ...foods.catalog, ...foods.hidden].find(x => x.id === meal.foodId) : undefined;
  const [opened, setOpened] = useState<MealAmount | null>(null);
  const origName = useRef(''); // the name `opened` was read from: saved back untouched unless something changes
  const food = opened?.linked ? linked : undefined;
  const parts = opened?.parts ?? { kind: 'none' as const };
  const [amt, setAmt] = useState({ unit: 'portion', qty: '1' });
  const base = useRef<{ qty: number; kcal: number; proteinG: number; carbsG?: number; fatG?: number; fiberG?: number; grams?: number } | null>(null);
  const [grams, setGrams] = useState<number | undefined>(undefined); // the weight to save once it changed; 0 = it no longer applies
  const measures = food ? measuresFor(food) : amt.unit === 'grams' ? [{ id: 'grams', label: parts.unit ?? 'g' }]
    : [{ id: 'portion', label: parts.kind === 'count' ? parts.label! : parts.kind === 'none' ? '× the portion as logged' : 'count' }];

  /** Open one meal: returns the name to show (without its amount). */
  const load = (m: Pick<Meal, 'name' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'grams'>, from?: Food) => {
    const o = openMealAmount(m, from);
    setOpened(o); origName.current = m.name;
    setAmt({ unit: o.unit, qty: String(o.qty) }); setGrams(undefined);
    // A weight stated in the name is the one the numbers are for; a stored one can be stale.
    base.current = { qty: o.qty, kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG, fiberG: m.fiberG, grams: o.unit === 'grams' ? o.qty : o.parts.grams ?? m.grams };
    return o.name;
  };

  // Re-runs when the linked food arrives (the catalogue loads after the page): only reload a form nobody has touched.
  const shown = useRef<string | null>(null);
  const dirty = useRef(false);
  useEffect(() => {
    if (!item) { shown.current = null; return; }
    if (shown.current === item.id && dirty.current) return;
    shown.current = item.id; dirty.current = false;
    const name = meal ? load(meal, linked) : undefined;
    setF({ ...toForm(meal, act), ...(name != null ? { name } : {}) }); setAsk(''); setNote(''); setSplit(null);
  }, [item?.id, !!linked]); // eslint-disable-line react-hooks/exhaustive-deps
  if (item && !meal && !act) return null;
  const isMeal = item?.kind === 'meal';
  const set = (p: Partial<Form>) => { dirty.current = true; setF(x => ({ ...x, ...p })); setSplit(null); };
  const amtQty = Number(amt.qty);
  const amtOk = amt.qty.trim() !== '' && Number.isFinite(amtQty) && amtQty > 0;
  // A new amount rewrites the numbers. An empty or zero amount changes nothing, so a half-typed field never zeroes the meal.
  const changeAmount = (next: { unit: string; qty: string }) => {
    dirty.current = true;
    setAmt(next); setSplit(null);
    const q = Number(next.qty);
    if (next.qty.trim() === '' || !Number.isFinite(q) || q <= 0 || !meal) return;
    if (food) {
      const m = scaleFood(food, amountOf(next.unit, q));
      if (!m) return;
      setF(x => ({ ...x, kcal: str(m.kcal), proteinG: str(m.proteinG), carbsG: str(m.carbsG), fatG: str(m.fatG), fiberG: str(m.fiberG) }));
      setGrams(m.grams);
    } else if (base.current) {
      const b = base.current;
      const r = rescaleMeal({ name: '', kcal: b.kcal, proteinG: b.proteinG, carbsG: b.carbsG, fatG: b.fatG, fiberG: b.fiberG, grams: b.grams }, q / b.qty);
      setF(x => ({ ...x, kcal: str(r.kcal), proteinG: str(r.proteinG), carbsG: str(r.carbsG), fatG: str(r.fatG), fiberG: str(r.fiberG) }));
      setGrams(next.unit === 'grams' ? Math.round(q) : r.grams);
    }
  };
  /** The name to save: untouched it is the original; otherwise the Food field with the amount written back in the name's own style. */
  const fullName = () => {
    if (!meal || !opened) return f.name.trim();
    const q = amtOk ? amtQty : opened.qty;
    return savedMealName(origName.current, opened, { name: f.name, unit: amt.unit, qty: q, amountChanged: amt.unit !== opened.unit || q !== opened.qty }, food);
  };

  // Energy split and a consistency check: protein and carbs are ~4 kcal/g, fat ~9.
  const p = num(f.proteinG), c = num(f.carbsG), fat = num(f.fatG), kcal = num(f.kcal);
  const fromMacros = Math.round(p * 4 + c * 4 + fat * 9);
  const shares = fromMacros ? [p * 4, c * 4, fat * 9].map(x => Math.round((x / fromMacros) * 100)) : null;
  const low = fromMacros > 0 && fromMacros > kcal * 1.02; // calories below what the macros add up to: saving raises them

  const save = () => {
    if (!item) return;
    if (split) { onReplace(item, split); onClose(); return; }
    const patch: Partial<Meal & Activity> = isMeal
      ? { name: fullName() || meal!.name, kcal, proteinG: p, carbsG: c, fatG: fat, fiberG: num(f.fiberG), notes: f.notes.trim() || undefined, ...(f.slot ? { slot: f.slot } : {}), ...(grams != null ? { grams } : {}) }
      : { name: f.name.trim() || act!.name, kcal, minutes: num(f.minutes), stepBased: f.stepBased, notes: f.notes.trim() || undefined };
    onSave(item, patch);
    onClose();
  };

  const askAi = async () => {
    if (!item || !ask.trim() || busy) return;
    if (aiDisabled) { setNote('Demo: sign in to edit with AI.'); return; }
    setBusy(true); setNote(''); dirty.current = true;
    const current: FitnessDraft = isMeal
      ? { date: day, meals: [{ name: fullName(), kcal, proteinG: p, carbsG: c, fatG: fat, fiberG: num(f.fiberG), ...(f.slot ? { slot: f.slot } : {}) }], activities: [], values: [] }
      : { date: day, meals: [], activities: [{ name: f.name, minutes: num(f.minutes), kcal, stepBased: f.stepBased }], values: [] };
    try {
      const r = await parseFitnessLog({ message: ask.trim(), todayYmd: today, dayYmd: day, trackers: [], currentDraft: current, webSearch, localTime: format(new Date(), 'HH:mm') }, selectedModel);
      if (isMeal && r.meals.length > 1) {
        const keepSlot = f.slot || undefined;
        setSplit({ date: day, meals: r.meals.map(m => ({ ...m, slot: m.slot ?? keepSlot })), activities: [], values: [] });
        setNote(`${r.reply} Save to replace this with ${r.meals.length} items.`);
      } else if (isMeal && r.meals[0]) {
        const m = r.meals[0];
        // The AI's numbers are now the ones the amount scales, and they no longer follow the saved food. The stored
        // weight was for the old numbers: save the AI's, or the one its name states, or clear it (0).
        const name = load(m);
        const o = openMealAmount(m);
        setGrams(m.grams ?? (o.parts.kind === 'weight' ? o.qty : 0));
        setF(x => ({ ...x, name, kcal: str(m.kcal), proteinG: str(m.proteinG), carbsG: str(m.carbsG), fatG: str(m.fatG), fiberG: str(m.fiberG), slot: m.slot ?? x.slot }));
        setNote(`${r.reply} Check it, then Save.`);
      } else if (!isMeal && r.activities[0]) {
        const a = r.activities[0];
        setF(x => ({ ...x, name: a.name, minutes: str(a.minutes), kcal: str(a.kcal), stepBased: a.stepBased }));
        setNote(`${r.reply} Check it, then Save.`);
      } else setNote("The AI didn't change anything. Try saying it differently.");
      setAsk('');
    } catch { setNote("Couldn't reach the AI. Check your connection and try again."); }
    finally { setBusy(false); }
  };

  const numField = (key: keyof Form, label: string, unit: string) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs">
      <span className="f-muted">{label}</span>
      <span className="flex items-center gap-1.5">
        <input className="f-input min-w-0 !py-2" type="number" inputMode="decimal" min={0} step="any" value={f[key] as string}
          onChange={e => set({ [key]: e.target.value } as Partial<Form>)} aria-label={label} />
        <span className="f-muted w-7 shrink-0">{unit}</span>
      </span>
    </label>
  );

  return (
    <Sheet open={!!item} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="fit-ui f-sheet max-h-[calc((100dvh-var(--kb,0px))*0.92)] overflow-y-auto rounded-t-[28px] border-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 sm:mx-auto sm:max-w-lg">
        <SheetTitle className="pr-10 fit-display text-2xl text-[var(--f-ink)]">{isMeal ? <>Meal <em>details</em></> : <>Workout <em>details</em></>}</SheetTitle>
        <SheetDescription className="pr-10 f-muted text-sm">Change anything below, or ask the AI. Nothing is saved until you tap Save.</SheetDescription>

        <div className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{isMeal ? 'Food' : 'Activity'}</span>
            <AutoTextarea value={f.name} onChange={e => set({ name: e.target.value })} aria-label={isMeal ? 'Food' : 'Activity'} />
          </label>

          {isMeal ? (
            <>
              <div className="space-y-1.5">
                <QtyMeasure qty={amt.qty} unit={amt.unit} measures={measures} onQty={q => changeAmount({ ...amt, qty: q })}
                  onUnit={u => changeAmount({ unit: u, qty: u === 'grams' ? String(grams ?? meal?.grams ?? 100) : '1' })} />
                <p className="f-muted text-xs">
                  {!amtOk ? <span className="f-bad">Enter an amount above 0 to save.</span> : food ? `Calories and macros follow the amount, from ${food.name}.`
                    : amt.unit === 'grams' ? 'Calories and macros scale with the weight.' : parts.kind !== 'none' ? 'Calories and macros scale with the quantity.'
                    : 'No amount was logged for this, so this scales the whole portion: 1 is as logged, 1.5 is half as much again.'}
                </p>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Meal</span>
                <select className="f-input" value={f.slot} onChange={e => set({ slot: e.target.value as MealSlot })}>
                  {!f.slot && <option value="">Choose…</option>}
                  {MEAL_SLOTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {numField('kcal', 'Calories', 'kcal')}
                {numField('proteinG', 'Protein', 'g')}
                {numField('carbsG', 'Carbs', 'g')}
                {numField('fatG', 'Fat', 'g')}
                {numField('fiberG', 'Fibre', 'g')}
              </div>
              {shares && (
                <div>
                  <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
                    <span style={{ width: `${shares[0]}%`, background: 'var(--f-chart-a)' }} />
                    <span style={{ width: `${shares[1]}%`, background: 'var(--f-sun)' }} />
                    <span style={{ width: `${shares[2]}%`, background: 'var(--f-chart-b)' }} />
                  </div>
                  <p className="f-muted mt-1.5 flex flex-wrap gap-x-3 text-xs">
                    <span>Protein {shares[0]}%</span><span>Carbs {shares[1]}%</span><span>Fat {shares[2]}%</span><span>of calories</span>
                  </p>
                  {low && (
                    <p className="mt-1.5 text-xs">
                      <span className="f-bad">These macros add up to {fromMacros.toLocaleString('en-US')} kcal, so it will be saved as at least that, to avoid under-counting.</span>{' '}
                      <button type="button" className="underline" onClick={() => set({ kcal: String(fromMacros) })}>Use {fromMacros.toLocaleString('en-US')}</button>
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {numField('minutes', 'Minutes', 'min')}
                {numField('kcal', 'Active calories', 'kcal')}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[var(--f-deep)]" checked={f.stepBased} onChange={e => set({ stepBased: e.target.checked })} />
                Walk, run or hike (already counted in your steps)
              </label>
            </>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Notes</span>
            <AutoTextarea value={f.notes} onChange={e => set({ notes: e.target.value })} placeholder="Optional: recipe, brand, how it went…" aria-label="Notes" />
          </label>

          <div className="space-y-2 rounded-2xl bg-[var(--f-tint)] p-3">
            <span className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="h-4 w-4 text-[var(--f-deep)]" aria-hidden />Edit with AI</span>
            <AutoTextarea value={ask} onChange={e => setAsk(e.target.value)} maxRows={5}
              placeholder={isMeal ? 'e.g. “it was 3 rotis, not 2” or “made with ghee”' : 'e.g. “it was 45 minutes, pretty intense”'}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void askAi(); } }} aria-label="What should the AI change?" />
            <button type="button" className="f-pill w-full" disabled={!ask.trim() || busy} onClick={() => void askAi()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}{busy ? 'Updating…' : 'Update with AI'}
            </button>
            {note && <p className="text-sm" aria-live="polite">{note}</p>}
            {split && <ul className="f-muted list-disc pl-5 text-xs">{split.meals.map((m, i) => <li key={i}>{m.name}: {Math.round(m.kcal)} kcal</li>)}</ul>}
          </div>

          <div className="flex gap-2">
            <button type="button" className="f-pill flex-1" onClick={() => { if (item) { onDelete(item); onClose(); } }}><Trash2 className="h-4 w-4" aria-hidden />Delete</button>
            <button type="button" className="f-pill f-pill-primary flex-[2]" disabled={isMeal && !amtOk && !split} onClick={save}>Save</button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
