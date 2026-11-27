import { useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Globe, Loader2, Pencil, Plus, Search, Sparkles, Star, X } from 'lucide-react';
import { useModelStore } from '@/hooks/use-model-store';
import { describeFood, type DescribedFood } from '@/ai/flows/describe-food';
import type { AppData, MealSlot } from '@/lib/types';
import { MEAL_SLOTS, type FitnessDraft } from '@/lib/fitness';
import { norm, perPieceTo100, scaleFood, type Amount, type Food } from '@/lib/food-match';
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
              <button type="button" className="f-muted flex h-9 w-9 items-center justify-center" aria-label="Remove serving" onClick={() => set({ servings: f.servings.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
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
  const { selectedModel, webSearch, setWebSearch } = useModelStore();
  const [how, setHow] = useState<'ai' | 'manual'>(aiDisabled ? 'manual' : 'ai');
  const [ask, setAsk] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<DescribedFood | null>(null);
  const run = async () => {
    if (!ask.trim() || busy) return;
    setBusy(true); setError('');
    try { setFound(await describeFood(ask, selectedModel, webSearch)); }
    catch { setError('Couldn’t look that up. Try again, or add it manually.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-1" role="group" aria-label="How to add">
        <button type="button" className="f-chip" data-on={how === 'ai'} aria-pressed={how === 'ai'} disabled={aiDisabled} onClick={() => setHow('ai')}><Sparkles className="h-3.5 w-3.5" aria-hidden />With AI</button>
        <button type="button" className="f-chip" data-on={how === 'manual'} aria-pressed={how === 'manual'} onClick={() => setHow('manual')}><Pencil className="h-3.5 w-3.5" aria-hidden />Manually</button>
      </div>
      {how === 'manual' ? <FoodEditor initial={{ name }} onSave={onSave} onCancel={onCancel} /> : found ? (
        <>
          <p className="f-muted text-sm">{found.note ? `${found.note}. ` : ''}Check the numbers, then save. {found.web ? '🌐 Checked the web.' : ''}</p>
          <FoodEditor initial={found} onSave={onSave} onCancel={() => setFound(null)} />
        </>
      ) : (
        <div className="space-y-2 rounded-2xl bg-[var(--f-tint)] p-3">
          <p className="text-sm">Name the food: add a brand, or paste the label, for packaged items. The AI fills in nutrition per 100 g and the usual servings.</p>
          <div className="flex gap-2">
            <input className="f-input min-w-0 flex-1" value={ask} onChange={e => setAsk(e.target.value)} placeholder="e.g. Amul Gold milk, steamed rice, MuscleBlaze whey"
              onKeyDown={e => e.key === 'Enter' && void run()} aria-label="Food to look up" autoFocus />
            <button type="button" className={`f-icon-btn h-11 w-11 shrink-0 ${webSearch ? '!border-[var(--f-deep)] !bg-[var(--f-deep)] !text-white' : ''}`} aria-pressed={webSearch}
              aria-label={`Web search ${webSearch ? 'on' : 'off'} (best for branded items)`} title="Web search: best for branded items" onClick={() => setWebSearch(!webSearch)}><Globe className="h-5 w-5" /></button>
          </div>
          {error && <p className="f-bad text-sm" aria-live="polite">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="f-pill flex-1" onClick={onCancel}>Cancel</button>
            <button type="button" className="f-pill f-pill-primary flex-[2]" disabled={!ask.trim() || busy} onClick={() => void run()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}{busy ? 'Looking it up…' : 'Fill in with AI'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pick an amount of one food and log it. */
function AmountPicker({ food, slot, onLog, onEdit, onDelete, builtIn }: { food: Food; slot: MealSlot; onLog: (m: FitnessDraft['meals'][number]) => void; onEdit: () => void; onDelete: () => void; /** Built-in foods are copied to edit, and "removed" (hidden for you) rather than deleted. */ builtIn?: boolean }) {
  const opts = food.unit === 'serving' ? [{ id: 'serving', label: 'serving' }] : [{ id: 'grams', label: food.unit }, ...food.servings.map(s => ({ id: `s:${s.label}`, label: s.label }))];
  const [unit, setUnit] = useState(opts.length > 1 ? opts[1].id : opts[0].id);
  const [qty, setQty] = useState(unit === 'grams' ? '100' : '1');
  const [to, setTo] = useState<MealSlot>(slot);
  const q = n(qty);
  const amount: Amount | null = q == null || q <= 0 ? null : unit === 'grams' ? { grams: q } : unit === 'serving' ? { count: q } : { count: q, label: unit.slice(2) };
  const meal = amount ? scaleFood(food, amount, to) : null;
  const quick = unit === 'grams' ? ['100', '150', '200', '250'] : ['0.5', '1', '2', '3'];
  return (
    <div className="space-y-3 border-t border-[var(--f-line)] bg-[var(--f-tint)] px-4 py-3">
      <div className="flex items-center gap-2">
        <input className="f-input !w-24 shrink-0 !py-2" type="number" inputMode="decimal" min={0} step="any" value={qty} onChange={e => setQty(e.target.value)} aria-label="Amount" autoFocus />
        <select className="f-input !py-2 min-w-0 flex-1" value={unit} onChange={e => { setUnit(e.target.value); setQty(e.target.value === 'grams' ? '100' : '1'); }} aria-label="Unit">
          {opts.map(o => <option key={o.id} value={o.id}>{o.id === 'grams' ? o.label : `× ${o.label}`}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {quick.map(v => <button key={v} type="button" className="f-chip !min-h-9" data-on={qty === v} onClick={() => setQty(v)}>{unit === 'grams' ? `${v} ${food.unit}` : `${v} ${unit === 'serving' ? 'serving' : unit.slice(2)}`}</button>)}
      </div>
      {food.unit === 'serving' && <p className="f-muted text-xs">Saved without a weight, so only servings work. Tap ✎ and add what 1 serving weighs to log it in g or ml too.</p>}
      <p className="text-sm tabular-nums">{meal ? <><strong>{meal.kcal} kcal</strong> · P {meal.proteinG} · C {meal.carbsG} · F {meal.fatG} · Fibre {meal.fiberG} g</> : <span className="f-muted">Enter an amount</span>}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select className="f-input !py-2 w-auto" value={to} onChange={e => setTo(e.target.value as MealSlot)} aria-label="Meal">
          {MEAL_SLOTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <button type="button" className="f-pill f-pill-primary flex-1" disabled={!meal} onClick={() => meal && onLog(meal)}><Plus className="h-4 w-4" aria-hidden />Log it</button>
        <button type="button" className="f-icon-btn h-11 w-11" aria-label={builtIn ? `Copy ${food.name} to My Foods to edit it` : `Edit ${food.name}`} title={builtIn ? 'Copy to My Foods' : 'Edit'} onClick={onEdit}>{builtIn ? <Copy className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}</button>
        <ConfirmDelete label={builtIn ? 'Remove' : 'Delete'} confirm="Sure?" className="!min-h-11 !px-3 !text-xs" onConfirm={onDelete} />
      </div>
    </div>
  );
}

const MAX_HITS = 40; // catalogue rows shown for a search; refine to see others

/** My Foods (yours, editable) and All foods (built in, read-only): search both, pick an amount and log it — no AI. */
export function FoodsPanel({ foods, data, day, slot, onSave, aiDisabled, manage }: { foods: FoodsApi; data: AppData; day: string; slot: MealSlot; onSave?: (d: FitnessDraft) => void; aiDisabled?: boolean; /** Profile page: tap a food to edit it; no logging. */ manage?: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Partial<Food> | null>(null);
  const [done, setDone] = useState('');
  const [undoHide, setUndoHide] = useState<string | null>(null);
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

  if (foods.status === 'loading') return <p className="f-muted py-6 text-center text-sm">Loading your foods…</p>;
  if (foods.status === 'missing') return <p className="f-muted text-sm">My Foods needs a one-time database step: run <code>supabase/notora-v5-foods-reminders.sql</code> in Supabase, then reopen this.</p>;
  if (foods.status === 'error') return <p className="f-bad text-sm">Couldn’t load your foods: {foods.error}</p>;
  const saveEdit = async (f: Omit<Food, 'id'> & { id?: string }) => { const r = await foods.save(f); if (r.ok) { setEditing(null); setDone(`${f.name} saved to My Foods ✓`); } return r; };
  if (editing) return editing.id || editing.kcal != null
    ? <FoodEditor initial={editing} onCancel={() => setEditing(null)} onSave={saveEdit} />
    : <AddFood name={editing.name ?? ''} aiDisabled={aiDisabled} onCancel={() => setEditing(null)} onSave={saveEdit} />;

  const mine = foods.foods
    .filter(f => !t || hits(f))
    .sort((a, b) => (usage.inSlot.get(b.id) ?? 0) - (usage.inSlot.get(a.id) ?? 0) || (usage.any.get(b.id) ?? 0) - (usage.any.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  const slotLabel = MEAL_SLOTS.find(s => s.id === slot)?.label ?? '';
  const copy = (f: Food) => { const { id: _drop, ...rest } = f; setEditing(rest); }; // eslint-disable-line @typescript-eslint/no-unused-vars

  const row = (f: Food, builtIn: boolean) => (
    <li key={f.id} className="border-t border-[var(--f-line)] first:border-t-0">
      <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open === f.id}
        onClick={() => (manage ? (builtIn ? copy(f) : setEditing(f)) : setOpen(o => (o === f.id ? null : f.id)))}>
        <Star className={`h-4 w-4 shrink-0 ${usage.inSlot.get(f.id) ? 'fill-[var(--f-sun)] text-[var(--f-sun)]' : 'f-muted'}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{f.name}</span>
          <span className="f-muted block truncate text-xs tabular-nums">{f.kcal} kcal · P {f.proteinG} g per {per(f)}{f.servings.length ? ` · 1 ${f.servings[0].label} = ${f.servings[0].amount} ${f.unit}` : ''}</span>
        </span>
      </button>
      {open === f.id && (
        <AmountPicker food={f} slot={slot} builtIn={builtIn} onEdit={() => (builtIn ? copy(f) : setEditing(f))}
          onDelete={() => { if (builtIn) { foods.hide(f.id); setUndoHide(f.id); setDone(`${f.name} removed from your list`); } else void foods.remove(f.id); setOpen(null); }}
          onLog={m => { onSave?.({ date: day, meals: [m], activities: [], values: [] }); setDone(`${m.name} logged ✓`); setOpen(null); }} />
      )}
    </li>
  );
  const toggleGroup = (g: string) => setOpenGroups(s => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="f-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden />
          <input className="f-input !pl-9" value={q} onChange={e => setQ(e.target.value)} placeholder="Search foods" aria-label="Search your foods and all foods" />
        </label>
        <button type="button" className="f-pill shrink-0" onClick={() => setEditing({ name: q })}><Plus className="h-4 w-4" aria-hidden />New</button>
      </div>
      {done && (
        <p className="f-good flex items-center gap-2 text-sm font-semibold" aria-live="polite">
          <span className="min-w-0 flex-1">{done}</span>
          {undoHide && <button type="button" className="f-chip !min-h-8" onClick={() => { foods.unhide(undoHide); setUndoHide(null); setDone(''); }}>Undo</button>}
        </p>
      )}

      {!(t && !mine.length && catHits.length) && <h3 className="f-muted text-xs font-semibold uppercase tracking-wide">My foods</h3>}
      {t && !mine.length && catHits.length ? null : !foods.foods.length ? (
        <p className="f-muted text-sm">Foods you save show here first, editable. Pick one below from All foods, tap <strong>New</strong> to add your own (with AI or manually), or ★ any AI result.</p>
      ) : !mine.length ? <p className="f-muted text-sm">None of your foods match “{q}”.</p> : (
        <>
          {!q && usage.inSlot.size > 0 && <p className="f-muted text-xs">Your usual {slotLabel.toLowerCase()} picks are first.</p>}
          <ul className="f-card overflow-hidden">{mine.map(f => row(f, false))}</ul>
        </>
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
                    <li key={f.id} className="flex items-center gap-3 border-t border-[var(--f-line)] px-4 py-2.5 first:border-t-0">
                      <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                      <button type="button" className="f-chip !min-h-8" onClick={() => foods.unhide(f.id)}>Restore</button>
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
