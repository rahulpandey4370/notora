// My Foods: saved items with exact nutrition, scaled to the amount eaten, and
// matching typed text ("150g rice, 2 roti") against them so a message made only
// of saved foods logs with no AI call. Pure; checked by
// `npx tsx src/lib/food-match.check.ts`.
import type { Meal, MealSlot } from '@/lib/types';

/**
 * Nutrition is per 100 g (unit 'g'), per 100 ml ('ml'), or per 1 serving ('serving').
 * `servings` name handy amounts in g/ml, e.g. { label: 'roti', amount: 40 }, so "2 rotis" needs no scale.
 */
export type Food = {
  id: string; name: string; aliases: string[]; unit: 'g' | 'ml' | 'serving';
  kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number;
  servings: { label: string; amount: number }[];
};
export type Amount = { grams: number } | { count: number; label?: string };
export type FoodDraftMeal = Omit<Meal, 'id'> & { foodId: string; grams?: number };

const r1 = (n: number) => Math.round(n * 10) / 10;
const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, half: 0.5, two: 2, three: 3, four: 4, five: 5, six: 6 };
const FILLER = new Set(['of', 'some', 'my', 'the', 'had', 'ate', 'i', 'just', 'eaten', 'for', 'breakfast', 'lunch', 'dinner', 'snack']);

/** Lowercase, no punctuation, simple singular ("rotis" → "roti", "eggs" → "egg"). */
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  .map(w => (w.length > 3 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && /(ch|sh|x|ss)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
  .join(' ');

/** A serving's typed name: its first word ("scoop (40 g)" → "scoop"). */
export const servingKey = (label: string) => norm(label).split(' ')[0] ?? '';

const unitLabel = (f: Food) => (f.unit === 'ml' ? 'ml' : 'g');

/** Grams (or ml) for an amount, when it can be known. */
export function amountIn(f: Food, a: Amount): number | null {
  if ('grams' in a) return f.unit === 'serving' ? null : a.grams;
  if (f.unit === 'serving') return null;
  const s = a.label ? f.servings.find(x => norm(x.label) === norm(a.label!)) ?? f.servings.find(x => servingKey(x.label) === servingKey(a.label!)) : f.servings[0];
  return s ? s.amount * a.count : null;
}

/** The food scaled to an amount, as a meal ready for the draft. null when the amount can't be applied (grams of a per-serving food). */
export function scaleFood(f: Food, a: Amount, slot?: MealSlot): FoodDraftMeal | null {
  let factor: number;
  let label: string;
  const grams = amountIn(f, a);
  if (f.unit === 'serving') {
    if ('grams' in a) return null;
    factor = a.count;
    label = a.count === 1 ? f.name : `${f.name} × ${r1(a.count)}`;
  } else {
    if (grams == null) return null;
    factor = grams / 100;
    label = 'count' in a ? `${f.name} × ${r1(a.count)} (${Math.round(grams)} ${unitLabel(f)})` : `${f.name}, ${Math.round(grams)} ${unitLabel(f)}`;
  }
  return {
    name: label, kcal: Math.round(f.kcal * factor), proteinG: r1(f.proteinG * factor), carbsG: r1(f.carbsG * factor),
    fatG: r1(f.fatG * factor), fiberG: r1(f.fiberG * factor), foodId: f.id, ...(grams != null ? { grams: Math.round(grams) } : {}), ...(slot ? { slot } : {}),
  };
}

/** Ways to measure a food: its named servings first ("roti (40 g)"), then weight; a per-serving food only by serving. */
export function measuresFor(f: Food): { id: string; label: string; grams?: number }[] {
  if (f.unit === 'serving') return [{ id: 'serving', label: 'serving' }];
  const u = unitLabel(f);
  return [
    ...f.servings.map(s => ({ id: `s:${s.label}`, label: /\d\s*(g|ml)\b/i.test(s.label) ? s.label : `${s.label} (${s.amount} ${u})`, grams: s.amount })),
    { id: 'grams', label: u },
  ];
}

/** A measure id from measuresFor plus a quantity, as an Amount for scaleFood. */
export const amountOf = (unit: string, qty: number): Amount =>
  unit === 'grams' ? { grams: qty } : unit === 'serving' ? { count: qty } : { count: qty, label: unit.slice(2) };

/** What "+" logs and the detail screen opens on: one of the first serving, else 100 g/ml. */
export function defaultAmount(f: Food): { unit: string; qty: number } {
  const first = measuresFor(f)[0].id;
  return { unit: first, qty: first === 'grams' ? 100 : 1 };
}

/**
 * The amount a logged meal was, for editing it. Only the weight is stored, so a serving count is offered only for the
 * app's own "Name × 2 (80 g)" names where the weight is that many servings. With no stored weight: the count in the
 * name, else the amount its calories imply; the food's default only when nothing says otherwise.
 */
export function guessAmount(f: Food, meal: { name: string; grams?: number; kcal?: number }): { unit: string; qty: number } {
  const count = Number(/×\s*(\d+(?:\.\d+)?)/.exec(meal.name)?.[1]);
  if (f.unit === 'serving') return { unit: 'serving', qty: count > 0 ? count : meal.kcal && f.kcal > 0 ? Math.round((meal.kcal / f.kcal) * 4) / 4 || 1 : 1 };
  if (!meal.grams) {
    if (count > 0 && f.servings.length) return { unit: `s:${f.servings[0].label}`, qty: count };
    return meal.kcal && f.kcal > 0 ? { unit: 'grams', qty: Math.round((meal.kcal / f.kcal) * 100) } : defaultAmount(f);
  }
  const s = count > 0 ? f.servings.find(x => Math.abs(x.amount * count - meal.grams!) < 1) : undefined;
  return s ? { unit: `s:${s.label}`, qty: count } : { unit: 'grams', qty: meal.grams };
}

/** A logged meal scaled to a new amount when its food isn't known: every number × factor, and the weight in its name updated. */
export function rescaleMeal<T extends { name: string; kcal: number; proteinG: number; carbsG?: number; fatG?: number; fiberG?: number; grams?: number }>(m: T, factor: number): T {
  const out: T = { ...m, kcal: Math.round(m.kcal * factor), proteinG: r1(m.proteinG * factor) };
  for (const k of ['carbsG', 'fatG', 'fiberG'] as const) if (m[k] != null) out[k] = r1(m[k]! * factor);
  if (m.grams) {
    out.grams = Math.round(m.grams * factor);
    out.name = m.name.replace(new RegExp(`\\b${m.grams}(\\s*)(g|ml)\\b`, 'i'), `${out.grams}$1$2`);
  }
  return out;
}

export type MealNameParts = { base: string; kind: 'x' | 'weight' | 'count' | 'lead' | 'none'; qty?: number; label?: string; unit?: 'g' | 'ml'; /** The weight in a "× 2 (80 g)" name. */ grams?: number };

/**
 * A logged meal's name without its amount, and that amount, so the edit screen can show them in separate fields.
 * ponytail: pattern-based. It reads the app's own names ("Roti × 2 (80 g)", "Chai, 120 ml") and the common AI ones
 * (", 1 plate", "2 rotis"); anything else is left whole ('none'). A capitalised word after a leading number is
 * taken as a brand ("5 Star"), not a count. Store qty + measure on the meal if names ever need more than this.
 */
export function splitMealName(name: string): MealNameParts {
  const n = name.trim();
  let m = /^(.+?)\s*×\s*(\d+(?:\.\d+)?)(?:\s*\((\d+(?:\.\d+)?)\s*(g|ml)\))?$/i.exec(n);
  if (m) return { base: m[1].trim(), kind: 'x', qty: Number(m[2]), ...(m[3] ? { grams: Number(m[3]), unit: m[4].toLowerCase() as 'g' | 'ml' } : {}) };
  m = /^(.+?)[,\s]\s*\(?(\d+(?:\.\d+)?)\s*(g|ml)\)?$/i.exec(n);
  if (m) return { base: m[1].replace(/,$/, '').trim(), kind: 'weight', qty: Number(m[2]), unit: m[3].toLowerCase() as 'g' | 'ml' };
  // Not for a meal of several things ("Dal, rice, 2 rotis", "2 rotis, dal"): a number there counts only one of them.
  const several = (x: string) => /,|\+|&|\band\b/i.test(x);
  m = /^(.+?),\s*(\d+(?:\.\d+)?)\s+([a-z][a-z ]{0,20})$/i.exec(n);
  if (m && !several(m[1])) return { base: m[1].trim(), kind: 'count', qty: Number(m[2]), label: m[3].trim() };
  m = /^(\d+(?:\.\d+)?)\s+([a-z].*)$/.exec(n);
  if (m && Number(m[1]) <= 20 && !several(m[2])) return { base: m[2].trim(), kind: 'lead', qty: Number(m[1]) };
  return { base: n, kind: 'none' };
}

/** The name to save: the (possibly renamed) food with its amount put back the way it was written. */
export function joinMealName(base: string, p: Omit<MealNameParts, 'base'>): string {
  const q = p.qty != null ? Math.round(p.qty * 100) / 100 : undefined; // 0.75 cup stays 0.75
  if (q == null || p.kind === 'none') return base;
  if (p.kind === 'x') return `${base} × ${q}${p.grams ? ` (${Math.round(p.grams)} ${p.unit ?? 'g'})` : ''}`;
  return p.kind === 'weight' ? `${base}, ${Math.round(q)} ${p.unit ?? 'g'}` : p.kind === 'count' ? `${base}, ${q} ${p.label}` : `${q} ${base}`;
}

/** A logged meal opened for editing: the name to show (without its amount), the amount, and whether its numbers still follow its food. */
export type MealAmount = { name: string; unit: string; qty: number; parts: Omit<MealNameParts, 'base'>; /** The app wrote the amount into the name, so a new amount rewrites it. */ appNamed: boolean; linked: boolean };

/**
 * How the edit screen opens a meal. It follows its food only while its numbers still match that food at the stored
 * amount (an AI or manual edit breaks that); otherwise the amount is read off the name ("× 3", ", 200 g", ", 1 plate",
 * "2 rotis"), which wins over a stored weight that may be stale, then the stored weight, then a plain ×1 multiplier.
 */
export function openMealAmount(m: { name: string; kcal: number; grams?: number }, f?: Food): MealAmount {
  const { base, ...parts } = splitMealName(m.name);
  if (f) {
    const a = guessAmount(f, m);
    const exp = scaleFood(f, amountOf(a.unit, a.qty));
    if (exp && Math.abs(exp.kcal - m.kcal) <= Math.max(3, m.kcal * 0.03)) {
      // "Milk, 200 ml" is the app's name for Milk; "Milk tea, 200 ml" is the user's own and keeps its base.
      const rest = m.name.startsWith(f.name) ? m.name.slice(f.name.length) : null;
      const app = rest != null && /^(\s*×\s*\d+(\.\d+)?(\s*\(\d+(\.\d+)?\s*(g|ml)\))?|,\s*\d+(\.\d+)?\s*(g|ml))?$/i.test(rest);
      const named = app || parts.kind === 'x' || parts.kind === 'weight';
      return { name: app ? f.name : named ? base : m.name, unit: a.unit, qty: a.qty, parts, appNamed: named, linked: true };
    }
  }
  if (parts.qty && (parts.kind === 'count' || parts.kind === 'lead' || parts.kind === 'x')) return { name: base, unit: 'portion', qty: parts.qty, parts, appNamed: false, linked: false };
  if (parts.kind === 'weight' && parts.qty) return { name: base, unit: 'grams', qty: parts.qty, parts, appNamed: false, linked: false };
  return { name: m.name, unit: m.grams ? 'grams' : 'portion', qty: m.grams ?? 1, parts: { kind: 'none', unit: parts.unit }, appNamed: false, linked: false };
}

/**
 * The name to save after editing. Untouched, it is the original, character for character; a rename swaps only the
 * food's part and keeps the amount as it was written; a new amount is written back in the name's own style.
 */
export function savedMealName(orig: string, o: MealAmount, now: { name: string; unit: string; qty: number; amountChanged: boolean }, f?: Food): string {
  const b = now.name.trim() || o.name;
  if (!now.amountChanged) return b === o.name ? orig : orig.replace(o.name, () => b);
  if (o.linked && f) {
    const m = o.appNamed ? scaleFood(f, amountOf(now.unit, now.qty)) : null;
    return m ? `${b}${m.name.slice(f.name.length)}` : b;
  }
  if (now.unit === 'grams') return o.parts.kind === 'weight' ? joinMealName(b, { kind: 'weight', qty: now.qty, unit: o.parts.unit }) : b;
  return joinMealName(b, { ...o.parts, qty: now.qty, grams: o.parts.grams ? (o.parts.grams * now.qty) / o.qty : undefined });
}

/**
 * Values for one piece/pack → per 100 g (or ml), with the piece kept as the first serving,
 * so a food logs both ways: "2 parathas" gives exactly the piece's numbers, "120 g" works too.
 */
export function perPieceTo100<T extends Omit<Food, 'id' | 'unit'>>(f: T, weight: number, unit: 'g' | 'ml', label: string): T & { unit: 'g' | 'ml' } {
  const k = 100 / weight;
  const key = norm(label);
  return {
    ...f, unit, kcal: r1(f.kcal * k), proteinG: r1(f.proteinG * k), carbsG: r1(f.carbsG * k), fatG: r1(f.fatG * k), fiberG: r1(f.fiberG * k),
    servings: [{ label, amount: weight }, ...f.servings.filter(s => norm(s.label) !== key)],
  };
}

/** Per-100 g (or per-serving) values from a logged portion, for "Save to My Foods". */
export function perBasis(m: Pick<Meal, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'>, grams?: number) {
  const f = grams && grams > 0 ? 100 / grams : 1;
  return { unit: (grams && grams > 0 ? 'g' : 'serving') as Food['unit'], kcal: Math.round(m.kcal * f), proteinG: r1(m.proteinG * f), carbsG: r1((m.carbsG ?? 0) * f), fatG: r1((m.fatG ?? 0) * f), fiberG: r1((m.fiberG ?? 0) * f) };
}

type Parsed = { name: string; amount?: Amount };

/** "150g rice" / "rice 150 g" / "2 rotis" / "2 scoops whey" / "0.2 kg paneer" → name + amount. */
export function parseSegment(seg: string): Parsed {
  let s = ` ${seg.toLowerCase().trim()} `;
  let amount: Amount | undefined;
  const g = s.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gms|gram|grams|ml|l|ltr|litre|liter)\b/);
  if (g) {
    const n = Number(g[1]);
    amount = { grams: /^(kg|kgs|l|ltr|litre|liter)$/.test(g[2]) ? n * 1000 : n };
    s = s.replace(g[0], ' ');
  } else {
    const c = s.match(/^\s*(\d+(?:\.\d+)?|a|an|one|half|two|three|four|five|six)\s+/);
    if (c) {
      const count = WORD_NUM[c[1]] ?? Number(c[1]);
      s = s.slice(c[0].length);
      amount = { count };
    }
  }
  const words = norm(s).split(' ').filter(w => w && !FILLER.has(w));
  return { name: words.join(' '), amount };
}

export type MatchResult =
  | { kind: 'all'; meals: FoodDraftMeal[] }
  | { kind: 'partial'; known: Food[] };

/** Segments: commas, "and", "+", "&", new lines, semicolons, "with". */
export const splitItems = (text: string) => text.split(/,|;|\n|\+|&|\band\b|\bwith\b/i).map(s => s.trim()).filter(Boolean);

/**
 * The best food for a name, or 'ambiguous' when two fit equally well. Your
 * history comes first (`prefer`: how often you logged each food id): of the
 * foods that fit, the one you log most wins, so "milk" means your usual milk.
 */
function findFood(name: string, foods: Food[], servingLabel?: string, prefer?: Map<string, number>): Food | 'ambiguous' | null {
  if (!name) return null;
  const words = new Set(name.split(' '));
  const scored = foods.map(f => {
    const names = [f.name, ...f.aliases].map(norm);
    let score = 0;
    for (const n of names) {
      if (n === name) score = Math.max(score, 3);
      else if (n.split(' ').every(w => words.has(w))) score = Math.max(score, 2); // "rice" saved, "steamed rice" typed
      else if (name.split(' ').every(w => n.split(' ').includes(w))) score = Math.max(score, 1); // "rice" typed, "steamed rice" saved
    }
    if (score && servingLabel && f.servings.some(s => servingKey(s.label) === servingLabel)) score += 0.5;
    return { f, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  // Foods you've logged before come first ("milk" = your usual milk, even if another has an exact "milk" alias).
  const mine = prefer ? scored.filter(x => (prefer.get(x.f.id) ?? 0) > 0) : [];
  if (mine.length) {
    mine.sort((a, b) => (prefer!.get(b.f.id)! - prefer!.get(a.f.id)!) || b.score - a.score);
    return mine[0].f;
  }
  const tied = scored.filter(x => x.score === scored[0].score);
  if (tied.length === 1) return tied[0].f;
  const used = tied.map(x => ({ f: x.f, n: prefer?.get(x.f.id) ?? 0 })).sort((a, b) => b.n - a.n);
  return used[0].n > 0 && used[0].n > used[1].n ? used[0].f : 'ambiguous';
}

type Resolved = { food?: Food; meal?: FoodDraftMeal };

/** One typed segment against one list: the food it names (if exactly one) and, when the amount is usable, the meal. */
function resolve(seg: string, foods: Food[], slot?: MealSlot, prefer?: Map<string, number>): Resolved {
  const p = parseSegment(seg);
  // "2 scoops whey": the first word may be a serving label.
  let name = p.name, label: string | undefined;
  if (p.amount && 'count' in p.amount) {
    const first = name.split(' ')[0];
    if (foods.some(f => f.servings.some(s => servingKey(s.label) === first)) && name.includes(' ')) { label = first; name = name.split(' ').slice(1).join(' '); }
  }
  let f = findFood(name, foods, label, prefer);
  if (f === null && !label) f = findFood(p.name, foods, undefined, prefer); // "roti" typed for a food whose serving is "roti"
  if (!f || f === 'ambiguous') return {};
  // Every typed word must be part of this food's name, an alias or a serving ("make it 3 rotis", "roti 3",
  // "brown rice" with only "rice" saved all go to the AI instead of being guessed).
  const vocab = new Set([f.name, ...f.aliases, ...f.servings.map(s => s.label)].flatMap(x => norm(x).split(' ')));
  if (!(label ? name : p.name).split(' ').every(w => vocab.has(w))) return { food: f };
  const amount: Amount | undefined = p.amount && 'count' in p.amount ? { count: p.amount.count, ...(label ? { label } : {}) } : p.amount;
  const meal = scaleFood(f, amount ?? (f.unit === 'serving' || f.servings.length ? { count: 1 } : { grams: NaN }), slot);
  return { food: f, ...(meal && Number.isFinite(meal.kcal) ? { meal } : {}) };
}

/** A raw item logs without the AI only when the message says "raw" ("chicken breast" is usually cooked). */
function named(seg: string, f: Food): boolean {
  const typed = new Set(norm(parseSegment(seg).name).split(' '));
  return !(norm(f.name).split(' ').includes('raw') && !typed.has('raw'));
}

/**
 * Whole message → meals, only if EVERY part is a known food with a usable
 * amount. Your saved foods are tried first, then the built-in catalogue (pass it
 * without raw ingredients: "200 g dal" must not log raw dal). Anything else (a
 * workout, a weight like "94.1 kg", an unknown dish, two foods that fit equally)
 * goes to the AI, with the foods it did recognise passed along so it uses their
 * exact numbers.
 */
export function matchText(text: string, foods: Food[], slot?: MealSlot, catalog: Food[] = [], prefer?: Map<string, number>): MatchResult {
  const known = new Map<string, Food>();
  const meals: FoodDraftMeal[] = [];
  let all = foods.length + catalog.length > 0;
  for (const seg of splitItems(text)) {
    let r = resolve(seg, foods, slot, prefer);
    if (!r.meal && catalog.length) {
      const c = resolve(seg, catalog, slot, prefer);
      if (c.meal && c.food && !named(seg, c.food)) r = { food: c.food }; // raw item not asked for: a hint for the AI
      else if (c.meal || !r.food) r = c;
    }
    if (r.food) known.set(r.food.id, r.food);
    if (r.meal) meals.push(r.meal); else all = false;
  }
  return all && meals.length ? { kind: 'all', meals } : { kind: 'partial', known: [...known.values()] };
}

// Words that say how much, not what: dropped before fuzzy matching.
const AMOUNT_WORD = /^(\d+(\.\d+)?|kg|g|gm|gram|ml|l|ltr|litre|liter|katori|bowl|cup|plate|piece|pc|pack|packet|slice|scoop|tbsp|tsp|spoon|glass|bar|half|full)$/;

/** Up to 1 typo for words of 5+ letters ("kurkre" ≈ "kurkure"). */
function nearWord(a: string, b: string): boolean {
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * The foods nearest to one typed item, best first: how many typed words the
 * food's name/aliases cover (exact > prefix > one typo), then how much of the
 * food's own name the typing covers or its best alias (so "coke" ranks
 * Coca-Cola, alias "coke", above Diet Coke). At least half the typed words must match.
 */
export function nearestFoods(item: string, foods: Food[], k = 3): Food[] {
  const typed = norm(parseSegment(item).name).split(' ').filter(w => w && !AMOUNT_WORD.test(w) && !FILLER.has(w));
  if (!typed.length) return [];
  const scored: { f: Food; score: number }[] = [];
  for (const f of foods) {
    const words = [...new Set([f.name, ...f.aliases].flatMap(x => norm(x).split(' ')).filter(Boolean))];
    let hit = 0;
    for (const t of typed) {
      let best = 0;
      for (const w of words) {
        const v = w === t ? 1 : (t.length >= 3 && (w.startsWith(t) || (w.length >= 3 && t.startsWith(w)))) ? 0.8 : nearWord(t, w) ? 0.6 : 0;
        if (v > best) best = v;
        if (best === 1) break;
      }
      hit += best;
    }
    const coverage = hit / typed.length;
    if (coverage < 0.5) continue;
    // How much of the food's name (or its best alias) the typing covers.
    const own = Math.max(...[f.name, ...f.aliases].map(n => {
      const ws = norm(n).split(' ').filter(Boolean);
      return ws.length ? ws.filter(w => typed.some(t => t === w || nearWord(t, w) || (t.length >= 3 && w.startsWith(t)))).length / ws.length : 0;
    }));
    scored.push({ f, score: coverage + 0.25 * own });
  }
  return scored.sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length).slice(0, k).map(x => x.f);
}

/**
 * Foods worth showing the AI for this message, nearest match first: what
 * matched exactly, then for each typed item its closest saved foods, then its
 * closest catalogue foods (pass the catalogue without raw ingredients). The AI
 * uses these numbers when one is the food named, else the web (if on) or its
 * own knowledge.
 */
export function foodsFor(text: string, foods: Food[], catalog: Food[] = []): Food[] {
  const r = matchText(text, foods, undefined, catalog);
  const pool = [...foods, ...catalog];
  const hit: Food[] = r.kind === 'partial' ? [...r.known] : pool.filter(f => r.meals.some(m => m.foodId === f.id));
  const add = (f: Food) => { if (!hit.includes(f)) hit.push(f); };
  for (const seg of splitItems(text)) {
    nearestFoods(seg, foods, 2).forEach(add);
    nearestFoods(seg, catalog, 3).forEach(add);
  }
  return hit.slice(0, 20);
}

/** One line per food for the AI prompt. */
export const describeFood = (f: Food) =>
  `${f.name}${f.aliases.length ? ` (also: ${f.aliases.join(', ')})` : ''}: per ${f.unit === 'serving' ? '1 serving' : `100 ${unitLabel(f)}`} ${f.kcal} kcal, P ${f.proteinG} g, C ${f.carbsG} g, F ${f.fatG} g, fibre ${f.fiberG} g`
  + (f.servings.length ? `; ${f.servings.map(s => `1 ${s.label} = ${s.amount} ${unitLabel(f)}`).join(', ')}` : '');
