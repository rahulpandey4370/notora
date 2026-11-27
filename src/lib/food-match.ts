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

const unitLabel = (f: Food) => (f.unit === 'ml' ? 'ml' : 'g');

/** Grams (or ml) for an amount, when it can be known. */
export function amountIn(f: Food, a: Amount): number | null {
  if ('grams' in a) return f.unit === 'serving' ? null : a.grams;
  if (f.unit === 'serving') return null;
  const s = a.label ? f.servings.find(x => norm(x.label) === norm(a.label!)) : f.servings[0];
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

/** The best saved food for a name, or 'ambiguous' when two fit equally well. */
function findFood(name: string, foods: Food[], servingLabel?: string): Food | 'ambiguous' | null {
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
    if (score && servingLabel && f.servings.some(s => norm(s.label) === servingLabel)) score += 0.5;
    return { f, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[1].score === scored[0].score) return 'ambiguous';
  return scored[0].f;
}

/**
 * Whole message → meals, only if EVERY part is a saved food with a usable
 * amount. Anything else (a workout, a weight like "94.1 kg", an unsaved dish,
 * two saved foods that fit equally) goes to the AI, with the saved foods it
 * did recognise passed along so it uses their exact numbers.
 */
export function matchText(text: string, foods: Food[], slot?: MealSlot): MatchResult {
  const known = new Map<string, Food>();
  const meals: FoodDraftMeal[] = [];
  let all = foods.length > 0;
  for (const seg of splitItems(text)) {
    const p = parseSegment(seg);
    // "2 scoops whey": the first word may be a serving label.
    let name = p.name, label: string | undefined;
    if (p.amount && 'count' in p.amount) {
      const first = name.split(' ')[0];
      if (foods.some(f => f.servings.some(s => norm(s.label) === first)) && name.includes(' ')) { label = first; name = name.split(' ').slice(1).join(' '); }
    }
    let f = findFood(name, foods, label);
    if (f === null && !label) f = findFood(p.name, foods); // "roti" typed for a food whose serving is "roti"
    if (f && f !== 'ambiguous') known.set(f.id, f);
    if (!f || f === 'ambiguous') { all = false; continue; }
    // Every typed word must be part of this food's name, an alias or a serving ("make it 3 rotis", "roti 3",
    // "brown rice" with only "rice" saved all go to the AI instead of being guessed).
    const vocab = new Set([f.name, ...f.aliases, ...f.servings.map(s => s.label)].flatMap(x => norm(x).split(' ')));
    if (!(label ? name : p.name).split(' ').every(w => vocab.has(w))) { all = false; continue; }
    const amount: Amount | undefined = p.amount && 'count' in p.amount ? { count: p.amount.count, ...(label ? { label } : {}) } : p.amount;
    const meal = scaleFood(f, amount ?? (f.unit === 'serving' || f.servings.length ? { count: 1 } : { grams: NaN }), slot);
    if (!meal || !Number.isFinite(meal.kcal)) { all = false; continue; }
    meals.push(meal);
  }
  return all && meals.length ? { kind: 'all', meals } : { kind: 'partial', known: [...known.values()] };
}

/** Saved foods worth showing the AI for this message (recognised ones, else any whose name appears). */
export function foodsFor(text: string, foods: Food[]): Food[] {
  const r = matchText(text, foods);
  const hit = r.kind === 'partial' ? r.known : foods.filter(f => r.meals.some(m => m.foodId === f.id));
  const t = norm(text);
  for (const f of foods) if (!hit.includes(f) && [f.name, ...f.aliases].some(n => norm(n) && t.includes(norm(n)))) hit.push(f);
  return hit.slice(0, 20);
}

/** One line per food for the AI prompt. */
export const describeFood = (f: Food) =>
  `${f.name}${f.aliases.length ? ` (also: ${f.aliases.join(', ')})` : ''}: per ${f.unit === 'serving' ? '1 serving' : `100 ${unitLabel(f)}`} ${f.kcal} kcal, P ${f.proteinG} g, C ${f.carbsG} g, F ${f.fatG} g, fibre ${f.fiberG} g`
  + (f.servings.length ? `; ${f.servings.map(s => `1 ${s.label} = ${s.amount} ${unitLabel(f)}`).join(', ')}` : '');
