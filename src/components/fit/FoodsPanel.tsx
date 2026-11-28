import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, Copy, Globe, Loader2, Minus, Pencil, Plus, Search, Sparkles, X } from 'lucide-react';
import { useModelFor, useModelStore } from '@/hooks/use-model-store';
import { useAsk } from '@/hooks/use-ask';
import { describeFood, type DescribedFood } from '@/ai/flows/describe-food';
import type { AppData, MealSlot } from '@/lib/types';
import { MEAL_SLOTS, type FitnessDraft } from '@/lib/fitness';
import { amountOf, defaultAmount, measuresFor, norm, perPieceTo100, scaleFood, type Food } from '@/lib/food-match';
import type { FoodsApi } from './useFoods';
import { INGREDIENTS, type CatalogFood } from '@/lib/food-catalog';
import { ConfirmDelete } from './TrackerSheet';

const n = (s: string) => { const v = Number(s); return s.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : undefined; };
const per = (f: Pick<Food, 'unit'>) => (f.unit === 'serving' ? '1 serving' : `100 ${f.unit}`);

/**
 * Add or edit a saved food. Values are per 100 g / 100 ml, or per 1 piece with what that piece weighs
 * (saved as per 100 g + the piece, so it logs by count and by weight), plus handy servings ("1 roti = 40 g").
 */
export function FoodEditor({ initial, onSave, onCancel }: {
  initial?: Partial<Food>; onSave: (f: Omit<Food, 'id'> & { id?: string }) => Promise<{ ok: boolean; error?: string }>; onCancel: () => void;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? '', aliases: (initial?.aliases ?? []).join(', '), unit: initial?.unit ?? 'g',
    kcal: initial?.kcal != null ? String(initial.kcal) : '', proteinG: initial?.proteinG != null ? String(initial.proteinG) : '',
    carbsG: initial?.carbsG != null ? String(initial.carbsG) : '', fatG: initial?.fatG != null ? String(initial.fatG) : '', fiberG: initial?.fiberG != null ? String(initial.fiberG) : '',
    servings: (initial?.servings ?? []).map(s => ({ label: s.label, amount: String(s.amount) })),
    piece: 'piece', pieceWeight: '', pieceUnit: 'g' as 'g' | 'ml',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
  const isPiece = f.unit === 'serving';
  const weight = n(f.pieceWeight);
  const valid = f.name.trim() && n(f.kcal) != null && (!isPiece || (!!weight && !!f.piece.trim()));
  const servingUnit = isPiece ? f.pieceUnit : f.unit;
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    const food = {
      name: f.name.trim(), aliases: f.aliases.split(',').map(a => a.trim()).filter(Boolean),
      kcal: n(f.kcal) ?? 0, proteinG: n(f.proteinG) ?? 0, carbsG: n(f.carbsG) ?? 0, fatG: n(f.fatG) ?? 0, fiberG: n(f.fiberG) ?? 0,
      servings: f.servings.flatMap(s => (s.label.trim() && n(s.amount) ? [{ label: s.label.trim(), amount: n(s.amount)! }] : [])),
    };
    const r = await onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      ...(isPiece ? perPieceTo100(food, weight!, f.pieceUnit, f.piece.trim()) : { ...food, unit: f.unit as 'g' | 'ml' }),
    });
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Couldn’t save.');
  };
  const field = (key: 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG', label: string) => (
    <label className="flex flex-col gap-1 text-xs"><span className="f-muted">{label}</span>
      <input className="f-input !py-2" type="number" inputMode="decimal" min={0} step="any" value={f[key]} onChange={e => set({ [key]: e.target.value } as Partial<typeof f>)} aria-label={label} />
    </label>
  );
  return (
    <div className="f-card space-y-3 p-4">
      <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Name</span>
        <input className="f-input" value={f.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Steamed white rice" aria-label="Food name" />
      </label>
      <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Also called <span className="f-muted font-normal">(optional, comma-separated)</span></span>
        <input className="f-input" value={f.aliases} onChange={e => set({ aliases: e.target.value })} placeholder="rice, chawal" aria-label="Other names" />
      </label>
      <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Values are per</span>
        <select className="f-input" value={f.unit} onChange={e => set({ unit: e.target.value as Food['unit'] })}>
          <option value="g">100 g</option><option value="ml">100 ml</option><option value="serving">1 piece / pack (roti, bar, bottle)</option>
        </select>
      </label>
      {isPiece && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="f-muted">1</span>
            <input className="f-input !py-1.5 min-w-[5rem] flex-1" value={f.piece} placeholder="piece, roti, bar" aria-label="Piece name" onChange={e => set({ piece: e.target.value })} />
            <span className="f-muted">weighs</span>
            <input className="f-input !py-1.5 !w-20 shrink-0" type="number" inputMode="decimal" min={0} step="any" value={f.pieceWeight} aria-label={`Weight of 1 ${f.piece || 'piece'}`} onChange={e => set({ pieceWeight: e.target.value })} />
            <select className="f-input !py-1.5 !w-16 shrink-0 !px-2" value={f.pieceUnit} aria-label="Weight unit" onChange={e => set({ pieceUnit: e.target.value as 'g' | 'ml' })}>
              <option value="g">g</option><option value="ml">ml</option>
            </select>
          </div>
          <p className="f-muted text-xs">Needed so it can be logged in {f.pieceUnit} as well as by count. Use the label&apos;s net weight, or weigh one.</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {field('kcal', 'kcal')}{field('proteinG', 'Protein g')}{field('carbsG', 'Carbs g')}{field('fatG', 'Fat g')}{field('fiberG', 'Fibre g')}
      </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Handy servings <span className="f-muted font-normal">(so “2 rotis” works without a scale)</span></p>
          {f.servings.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="f-muted">1</span>
              <input className="f-input !py-1.5 min-w-0 flex-1" value={s.label} placeholder="roti, scoop, katori" aria-label="Serving name"
                onChange={e => set({ servings: f.servings.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <span className="f-muted">=</span>
              <input className="f-input !py-1.5 !w-20 shrink-0" type="number" inputMode="decimal" min={0} step="any" value={s.amount} aria-label={`Serving size in ${servingUnit}`}
                onChange={e => set({ servings: f.servings.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)) })} />
              <span className="f-muted w-5">{servingUnit}</span>
              <button type="button" className="f-muted flex h-11 w-11 shrink-0 items-center justify-center" aria-label="Remove serving" onClick={() => set({ servings: f.servings.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
            </div>
          ))}
          {f.servings.length < 5 && <button type="button" className="f-chip" onClick={() => set({ servings: [...f.servings, { label: '', amount: '' }] })}><Plus className="h-3.5 w-3.5" aria-hidden />Add a serving</button>}
        </div>
      {error && <p className="f-bad text-sm" aria-live="polite">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="f-pill flex-1" onClick={onCancel}>Cancel</button>
        <button type="button" className="f-pill f-pill-primary flex-[2]" disabled={!valid || busy} onClick={() => void submit()}><Check className="h-4 w-4" aria-hidden />{initial?.id ? 'Save changes' : 'Save to My Foods'}</button>
      </div>
    </div>
  );
}

/** A new food: let the AI fill in the nutrition (you check it), or type it in yourself. Either way it's saved to My Foods. */
function AddFood({ name, aiDisabled, onSave, onCancel }: {
  name: string; aiDisabled?: boolean; onSave: (f: Omit<Food, 'id'> & { id?: string }) => Promise<{ ok: boolean; error?: string }>; onCancel: () => void;
}) {
  const { webSearch, setWebSearch } = useModelStore();
  const selectedModel = useModelFor('food');
  const [how, setHow] = useState<'ai' | 'manual'>(aiDisabled ? 'manual' : 'ai');
  const [ask, setAsk] = useState(name);
  // lib/ask: idle → pending → ready | failed. Switching to Manual or cancelling drops a lookup still on its way.
  const look = useAsk<DescribedFood>();
  const found = look.value ?? null, busy = look.pending, error = look.error;
  const run = () => { if (ask.trim() && !busy) void look.run(() => describeFood(ask, selectedModel, webSearch), { error: 'Couldn’t look that up. Try again, or add it manually.' }); };
  return (
    <div className="space-y-3">
      <div className="flex gap-1" role="group" aria-label="How to add">
        <button type="button" className="f-chip" data-on={how === 'ai'} aria-pressed={how === 'ai'} disabled={aiDisabled} onClick={() => setHow('ai')}><Sparkles className="h-3.5 w-3.5" aria-hidden />With AI</button>
        <button type="button" className="f-chip" data-on={how === 'manual'} aria-pressed={how === 'manual'} onClick={() => { if (look.pending) look.reset(); setHow('manual'); }}><Pencil className="h-3.5 w-3.5" aria-hidden />Manually</button>
      </div>
      {how === 'manual' ? <FoodEditor initial={{ name }} onSave={onSave} onCancel={onCancel} /> : found ? (
        <>
          <p className="f-muted text-sm">{found.note ? `${found.note}. ` : ''}Check the numbers, then save. {found.web ? '🌐 Checked the web.' : ''}</p>
          <FoodEditor initial={found} onSave={onSave} onCancel={look.reset} />
        </>
      ) : (
        <div className="space-y-2 rounded-2xl bg-[var(--f-tint)] p-3">
          <p className="text-sm">Name the food: add a brand, or paste the label, for packaged items. The AI fills in nutrition per 100 g and the usual servings.</p>
          <div className="flex gap-2">
            <input className="f-input min-w-0 flex-1" value={ask} onChange={e => setAsk(e.target.value)} placeholder="e.g. Amul Gold milk, steamed rice, MuscleBlaze whey"
              onKeyDown={e => e.key === 'Enter' && run()} aria-label="Food to look up" autoFocus />
            <button type="button" className={`f-icon-btn h-11 w-11 shrink-0 ${webSearch ? '!border-[var(--f-deep)] !bg-[var(--f-deep)] !text-white' : ''}`} aria-pressed={webSearch}
              aria-label={`Web search ${webSearch ? 'on' : 'off'} (best for branded items)`} title="Web search: best for branded items" onClick={() => setWebSearch(!webSearch)}><Globe className="h-5 w-5" /></button>
          </div>
          {error && <p className="f-bad text-sm" aria-live="polite">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="f-pill flex-1" onClick={onCancel}>Cancel</button>
            <button type="button" className="f-pill f-pill-primary flex-[2]" disabled={!ask.trim() || busy} onClick={run}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}{busy ? 'Looking it up…' : 'Fill in with AI'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Quantity (with − / +) and measure (g/ml or a named serving): the same two fields when adding a food and when editing a logged one. */
export function QtyMeasure({ qty, unit, measures, onQty, onUnit }: {
  qty: string; unit: string; measures: { id: string; label: string }[]; onQty: (q: string) => void; onUnit: (u: string) => void;
}) {
  const step = unit === 'grams' ? 10 : 0.5;
  const bump = (d: number) => onQty(String(Math.max(0, Math.round(((n(qty) ?? 0) + d) * 100) / 100)));
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Quantity</span>
        <span className="flex items-center gap-2">
          <button type="button" className="f-icon-btn h-11 w-11 shrink-0" aria-label={`Less (${step})`} onClick={() => bump(-step)}><Minus className="h-4 w-4" /></button>
          <input className="f-input min-w-0 flex-1 !py-2 text-center tabular-nums sm:!w-24 sm:flex-none" type="number" inputMode="decimal" min={0} step="any" value={qty} onChange={e => onQty(e.target.value)} aria-label="Quantity" />
          <button type="button" className="f-icon-btn h-11 w-11 shrink-0" aria-label={`More (${step})`} onClick={() => bump(step)}><Plus className="h-4 w-4" /></button>
        </span>
      </div>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Measure</span>
        <select className="f-input !py-2" value={unit} onChange={e => onUnit(e.target.value)} aria-label="Measure" disabled={measures.length < 2}>
          {measures.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
    </div>
  );
}

/** One food in full before logging it: the whole name, what the chosen amount comes to, quantity + measure, and one Add button. */
function FoodDetail({ food, slot, builtIn, group, onBack, onLog, onEdit, onDelete }: {
  food: Food; slot: MealSlot; onBack: () => void; onLog: (m: FitnessDraft['meals'][number]) => void; onEdit: () => void; onDelete: () => void;
  /** Built-in foods are copied to edit, and "removed" (hidden for you) rather than deleted. */ builtIn?: boolean; group?: string;
}) {
  const measures = measuresFor(food);
  const start = defaultAmount(food);
  const [unit, setUnit] = useState(start.unit);
  const [qty, setQty] = useState(String(start.qty));
  const [to, setTo] = useState<MealSlot>(slot);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); }, []);
  const q = n(qty);
  const meal = q != null && q > 0 ? scaleFood(food, amountOf(unit, q), to) : null;
  const quick = unit === 'grams' ? ['50', '100', '150', '200', '250'] : ['0.5', '1', '1.5', '2', '3'];
  const u = food.unit === 'ml' ? 'ml' : 'g';
  const shares = meal && meal.kcal > 0 ? [meal.proteinG * 4, (meal.carbsG ?? 0) * 4, (meal.fatG ?? 0) * 9] : null;
  const sum = shares ? shares[0] + shares[1] + shares[2] : 0;
  const toLabel = MEAL_SLOTS.find(x => x.id === to)?.label ?? 'log';
  const tile = (label: string, value: number | undefined, color?: string) => (
    <div className="rounded-2xl bg-[var(--f-tint)] px-2 py-2 text-center">
      <p className="text-base font-semibold tabular-nums">{meal ? value ?? 0 : '–'}<span className="f-muted text-xs font-normal"> g</span></p>
      <p className="f-muted flex items-center justify-center gap-1 text-[11px]">{color && <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />}{label}</p>
    </div>
  );
  return (
    <div ref={top} className="space-y-4">
      <button type="button" className="f-chip -ml-1" onClick={onBack}><ChevronLeft className="h-4 w-4" aria-hidden />All foods</button>
      <div>
        <h3 className="select-text break-words text-xl font-semibold leading-snug">{food.name}</h3>
        <p className="f-muted select-text text-xs">{builtIn ? `${group ?? 'Built-in food'} · built-in` : 'My food'}{food.aliases.length ? ` · also: ${food.aliases.join(', ')}` : ''}</p>
      </div>

      <div className="f-card space-y-3 p-4" aria-live="polite">
        <p className="flex items-baseline gap-2">
          <span className="fit-display text-4xl tabular-nums">{meal ? meal.kcal : '–'}</span><span className="f-muted text-sm">kcal</span>
          <span className="f-muted ml-auto text-right text-xs">{meal ? (meal.grams != null ? `for ${meal.grams} ${u}` : `for ${qty} serving${q === 1 ? '' : 's'}`) : 'Enter an amount'}</span>
        </p>
        <div className="grid grid-cols-4 gap-2">
          {tile('Protein', meal?.proteinG, 'var(--f-chart-a)')}{tile('Carbs', meal?.carbsG, 'var(--f-sun)')}{tile('Fat', meal?.fatG, 'var(--f-chart-b)')}{tile('Fibre', meal?.fiberG)}
        </div>
        {shares && sum > 0 && (
          <div className="flex h-2 overflow-hidden rounded-full" role="img" aria-label={`Calories from protein ${Math.round((shares[0] / sum) * 100)}%, carbs ${Math.round((shares[1] / sum) * 100)}%, fat ${Math.round((shares[2] / sum) * 100)}%`}>
            <span style={{ width: `${(shares[0] / sum) * 100}%`, background: 'var(--f-chart-a)' }} />
            <span style={{ width: `${(shares[1] / sum) * 100}%`, background: 'var(--f-sun)' }} />
            <span style={{ width: `${(shares[2] / sum) * 100}%`, background: 'var(--f-chart-b)' }} />
          </div>
        )}
      </div>

      <QtyMeasure qty={qty} unit={unit} measures={measures} onQty={setQty} onUnit={v => { setUnit(v); setQty(v === 'grams' ? '100' : '1'); }} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common amounts">
        {quick.map(v => <button key={v} type="button" className="f-chip" data-on={qty === v} aria-pressed={qty === v} onClick={() => setQty(v)}>{unit === 'grams' ? `${v} ${u}` : `× ${v}`}</button>)}
      </div>
      {food.unit === 'serving'
        ? <p className="f-muted text-xs">Saved without a weight, so only servings work. Edit it and add what 1 serving weighs to log it in g or ml too.</p>
        : <p className="f-muted select-text text-xs tabular-nums">Per 100 {u}: {food.kcal} kcal · P {food.proteinG} · C {food.carbsG} · F {food.fatG} · Fibre {food.fiberG} g</p>}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Meal</span>
        <select className="f-input !py-2" value={to} onChange={e => setTo(e.target.value as MealSlot)}>
          {MEAL_SLOTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="f-chip" onClick={onEdit}>{builtIn ? <Copy className="h-3.5 w-3.5" aria-hidden /> : <Pencil className="h-3.5 w-3.5" aria-hidden />}{builtIn ? 'Copy to My Foods to edit' : 'Edit this food'}</button>
        <ConfirmDelete label={builtIn ? 'Remove from my list' : 'Delete'} confirm="Sure?" className="!min-h-11 !px-3 !text-xs" onConfirm={onDelete} />
      </div>

      {/* Stays in reach at the bottom of the sheet, above the keyboard. */}
      <div className="sticky bottom-0 -mx-5 border-t border-[var(--f-line)] bg-[var(--f-bg)] px-5 py-3">
        <button type="button" className="f-pill f-pill-primary w-full" disabled={!meal} onClick={() => meal && onLog(meal)}><Plus className="h-4 w-4" aria-hidden />Add to {toLabel}</button>
      </div>
    </div>
  );
}

const MAX_HITS = 40; // catalogue rows shown for a search; refine to see others
const FREQUENT = 6;

/**
 * My Foods (yours, editable) and All foods (built in, read-only): search both; "+" logs a food's usual serving at once,
 * tapping it opens the full detail with quantity and measure — no AI.
 */
export function FoodsPanel({ foods, data, day, slot, onSave, onUndo, aiDisabled, manage }: {
  foods: FoodsApi; data: AppData; day: string; slot: MealSlot; aiDisabled?: boolean;
  /** Logs the draft; returns the ids of the meals it added so a quick-add can be undone. */
  onSave?: (d: FitnessDraft) => string[] | void; onUndo?: (mealIds: string[]) => void;
  /** Profile page: tap a food to edit it; no logging. */ manage?: boolean;
}) {
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<{ food: Food; builtIn: boolean } | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Partial<Food> | null>(null);
  const [done, setDone] = useState<{ text: string; unhide?: string; mealIds?: string[] } | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  // How often each food was logged in this meal / at all, so the usual picks come first.
  const usage = useMemo(() => {
    const inSlot = new Map<string, number>(), any = new Map<string, number>();
    for (const day of Object.values(data.fitnessDays ?? {})) for (const m of day.meals) {
      if (!m.foodId) continue;
      any.set(m.foodId, (any.get(m.foodId) ?? 0) + 1);
      if (m.slot === slot) inSlot.set(m.foodId, (inSlot.get(m.foodId) ?? 0) + 1);
    }
    return { inSlot, any };
  }, [data.fitnessDays, slot]);

  const t = norm(q);
  const byGroup = useMemo(() => {
    const m = new Map<string, CatalogFood[]>();
    for (const f of foods.catalog) m.set(f.group, [...(m.get(f.group) ?? []), f]);
    return [...m];
  }, [foods.catalog]);
  // Every typed word must appear in the name or an alias: "lays masala" finds "Lay's India's Magic Masala".
  const hits = (f: Food) => { const hay = norm([f.name, ...f.aliases].join(' ')); return t.split(' ').every(w => hay.includes(w)); };
  // Exact name/alias first, then names starting with the search, then the rest; raw ingredients last.
  const rank = (f: CatalogFood) => (f.group === INGREDIENTS ? 10 : 0) + ([f.name, ...f.aliases].some(x => norm(x) === t) ? 0 : norm(f.name).startsWith(t) ? 1 : 2);
  const catHits = useMemo(() => (t ? foods.catalog.filter(hits).sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length) : []), [t, foods.catalog]); // eslint-disable-line react-hooks/exhaustive-deps
  // The foods you log most (this meal first), from My Foods and the catalogue alike.
  const frequent = useMemo(() => {
    const mine = new Set(foods.foods.map(f => f.id));
    return [...foods.foods, ...foods.catalog].filter(f => usage.any.has(f.id))
      .sort((a, b) => (usage.inSlot.get(b.id) ?? 0) - (usage.inSlot.get(a.id) ?? 0) || (usage.any.get(b.id) ?? 0) - (usage.any.get(a.id) ?? 0))
      .slice(0, FREQUENT).map(f => ({ food: f as Food, builtIn: !mine.has(f.id) }));
  }, [foods.foods, foods.catalog, usage]);

  if (foods.status === 'loading') return <p className="f-muted py-6 text-center text-sm">Loading your foods…</p>;
  if (foods.status === 'missing') return <p className="f-muted text-sm">My Foods needs a one-time database step: run <code>supabase/notora-v5-foods-reminders.sql</code> in Supabase, then reopen this.</p>;
  if (foods.status === 'error') return <p className="f-bad text-sm">Couldn’t load your foods: {foods.error}</p>;
  const saveEdit = async (f: Omit<Food, 'id'> & { id?: string }) => { const r = await foods.save(f); if (r.ok) { setEditing(null); setDone({ text: `${f.name} saved to My Foods ✓` }); } return r; };
  if (editing) return (
    <div className="pb-5">
      {editing.id || editing.kcal != null
        ? <FoodEditor initial={editing} onCancel={() => setEditing(null)} onSave={saveEdit} />
        : <AddFood name={editing.name ?? ''} aiDisabled={aiDisabled} onCancel={() => setEditing(null)} onSave={saveEdit} />}
    </div>
  );

  const copy = (f: Food) => { const { id: _drop, ...rest } = f; setEditing(rest); }; // eslint-disable-line @typescript-eslint/no-unused-vars
  const log = (m: FitnessDraft['meals'][number]) => {
    const ids = onSave?.({ date: day, meals: [m], activities: [], values: [] });
    setDone({ text: `${m.name} logged ✓`, mealIds: ids || undefined });
  };
  if (detail) {
    const { food: f, builtIn } = detail;
    return (
      <FoodDetail food={f} slot={slot} builtIn={builtIn} group={builtIn ? (f as CatalogFood).group : undefined} onBack={() => setDetail(null)}
        onEdit={() => { setDetail(null); if (builtIn) copy(f); else setEditing(f); }}
        onDelete={() => { if (builtIn) { foods.hide(f.id); setDone({ text: `${f.name} removed from your list`, unhide: f.id }); } else void foods.remove(f.id); setDetail(null); }}
        onLog={m => { log(m); setDetail(null); }} />
    );
  }

  const mine = foods.foods
    .filter(f => !t || hits(f))
    .sort((a, b) => (usage.inSlot.get(b.id) ?? 0) - (usage.inSlot.get(a.id) ?? 0) || (usage.any.get(b.id) ?? 0) - (usage.any.get(a.id) ?? 0) || a.name.localeCompare(b.name));

  // One row: the whole name (it wraps, never cut), the usual serving and what it comes to, and "+" to log that serving at once.
  const row = (f: Food, builtIn: boolean) => {
    const d = defaultAmount(f);
    const usual = scaleFood(f, amountOf(d.unit, d.qty), slot);
    const serving = d.unit === 'grams' ? `100 ${f.unit}` : d.unit === 'serving' ? '1 serving' : `1 ${measuresFor(f)[0].label}`;
    return (
      <li key={f.id} className="flex items-stretch border-t border-[var(--f-line)] first:border-t-0">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-1 text-left" aria-label={manage ? `Edit ${f.name}` : `${f.name}: details and amount`}
          onClick={() => (manage ? (builtIn ? copy(f) : setEditing(f)) : setDetail({ food: f, builtIn }))}>
          <span className="min-w-0 flex-1">
            <span className="block break-words font-medium leading-snug">{f.name}</span>
            <span className="f-muted block text-xs tabular-nums">{serving} · P {usual?.proteinG ?? f.proteinG} g</span>
          </span>
          <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{usual?.kcal ?? f.kcal}<span className="f-muted block text-[10px] font-normal">kcal</span></span>
        </button>
        {manage ? <span className="w-3 shrink-0" /> : (
          <button type="button" className="flex w-14 shrink-0 items-center justify-center" aria-label={`Add ${serving} of ${f.name}`} disabled={!usual} onClick={() => usual && log(usual)}>
            <span className="f-icon-btn h-9 w-9 !border-[var(--f-deep)] !bg-[var(--f-deep)] !text-white dark:!text-[#04201f]"><Plus className="h-4 w-4" aria-hidden /></span>
          </button>
        )}
      </li>
    );
  };
  const toggleGroup = (g: string) => setOpenGroups(s => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  return (
    <div className="space-y-3 pb-5">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="f-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden />
          <input className="f-input !pl-9" type="search" enterKeyHint="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search foods" aria-label="Search your foods and all foods" />
        </label>
        <button type="button" className="f-pill shrink-0" onClick={() => setEditing({ name: q })}><Plus className="h-4 w-4" aria-hidden />New</button>
      </div>
      {done && (
        <p className="f-good flex items-center gap-2 text-sm font-semibold" aria-live="polite">
          <span className="min-w-0 flex-1 select-text">{done.text}</span>
          {done.unhide && <button type="button" className="f-chip" onClick={() => { foods.unhide(done.unhide!); setDone(null); }}>Undo</button>}
          {done.mealIds?.length && onUndo ? <button type="button" className="f-chip" onClick={() => { onUndo(done.mealIds!); setDone(null); }}>Undo</button> : null}
        </p>
      )}

      {!t && !manage && frequent.length > 0 && (
        <>
          <h3 className="f-muted text-xs font-semibold uppercase tracking-wide">Frequent</h3>
          <ul className="f-card overflow-hidden">{frequent.map(x => row(x.food, x.builtIn))}</ul>
        </>
      )}

      {!(t && !mine.length && catHits.length) && <h3 className="f-muted text-xs font-semibold uppercase tracking-wide">My foods</h3>}
      {t && !mine.length && catHits.length ? null : !foods.foods.length ? (
        <p className="f-muted text-sm">Foods you save show here first, editable. Pick one below from All foods, tap <strong>New</strong> to add your own (with AI or manually), or ★ any AI result.</p>
      ) : !mine.length ? <p className="f-muted text-sm">None of your foods match “{q}”.</p> : (
        <ul className="f-card overflow-hidden">{mine.map(f => row(f, false))}</ul>
      )}

      {foods.catalog.length > 0 && <h3 className="f-muted pt-1 text-xs font-semibold uppercase tracking-wide">All foods</h3>}
      {t ? (
        !catHits.length ? (foods.catalog.length > 0 && <p className="f-muted text-sm">Nothing in All foods matches “{q}”. Tap <strong>New</strong> to add it.</p>) : (
          <>
            <ul className="f-card overflow-hidden">{catHits.slice(0, MAX_HITS).map(f => row(f, true))}</ul>
            {catHits.length > MAX_HITS && <p className="f-muted text-xs">Showing {MAX_HITS} of {catHits.length}. Type more to narrow it down.</p>}
          </>
        )
      ) : (
        <div className="space-y-2">
          {byGroup.map(([g, list]) => (
            <section key={g} className="f-card overflow-hidden">
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={openGroups.has(g)} onClick={() => toggleGroup(g)}>
                <span className="min-w-0 flex-1 font-medium">{g}</span>
                <span className="f-muted text-xs tabular-nums">{list.length}</span>
                <ChevronDown className={`f-muted h-4 w-4 transition-transform ${openGroups.has(g) ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {openGroups.has(g) && <ul className="border-t border-[var(--f-line)]">{list.map(f => row(f, true))}</ul>}
            </section>
          ))}
          {foods.hidden.length > 0 && (
            <section className="f-card overflow-hidden">
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={showHidden} onClick={() => setShowHidden(v => !v)}>
                <span className="f-muted min-w-0 flex-1 font-medium">Removed foods</span>
                <span className="f-muted text-xs tabular-nums">{foods.hidden.length}</span>
                <ChevronDown className={`f-muted h-4 w-4 transition-transform ${showHidden ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {showHidden && (
                <ul className="border-t border-[var(--f-line)]">
                  {foods.hidden.map(f => (
                    <li key={f.id} className="flex items-center gap-3 border-t border-[var(--f-line)] px-4 py-2 first:border-t-0">
                      <span className="min-w-0 flex-1 break-words text-sm">{f.name}</span>
                      <button type="button" className="f-chip" onClick={() => foods.unhide(f.id)}>Restore</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {byGroup.length > 0 && <p className="f-muted text-xs">Built-in values from product labels, IFCT 2017 (NIN), the Indian Nutrient Databank, USDA FoodData Central and Open Food Facts (ODbL). Copy one to My Foods to change it, or remove ones you don’t need.</p>}
        </div>
      )}
    </div>
  );
}
