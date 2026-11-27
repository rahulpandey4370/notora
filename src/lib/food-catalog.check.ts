// Run: npx tsx src/lib/food-catalog.check.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromFile, INGREDIENTS, matchable, type CatalogFile } from './food-catalog';
import { foodsFor, matchText, nearestFoods, type Food } from './food-match';

const catalog = fromFile(JSON.parse(readFileSync(new URL('../data/food-catalog.json', import.meta.url), 'utf8')) as CatalogFile);
assert.ok(catalog.length > 400, 'catalogue loads');
assert.equal(new Set(catalog.map(f => f.id)).size, catalog.length, 'ids are unique');
assert.equal(catalog.at(-1)!.group, INGREDIENTS, 'Ingredients come last');
for (const f of catalog) {
  assert.ok(f.kcal >= 0 && f.proteinG >= 0 && f.carbsG >= 0 && f.fatG >= 0, `${f.name}: no negative values`);
  if (f.unit !== 'serving') assert.ok(f.kcal <= 902, `${f.name}: per-100 kcal is plausible`);
}
const cat = matchable(catalog);
assert.ok(!cat.some(f => f.group === INGREDIENTS), 'raw ingredients are never auto-matched');

// Built-in eggs log with no AI: 2 × 50 g boiled egg.
const eggs = matchText('2 boiled eggs', [], 'breakfast', cat);
assert.equal(eggs.kind, 'all');
if (eggs.kind === 'all') { assert.equal(eggs.meals[0].grams, 100); assert.match(eggs.meals[0].foodId, /^cat-/); }

// Raw dal (an ingredient) must not be logged for "200 g toor dal"; it goes to the AI.
assert.equal(matchText('200 g toor dal', [], undefined, cat).kind, 'partial');
const raw = new Set(catalog.filter(f => f.group === INGREDIENTS).map(f => f.id));
assert.ok(!foodsFor('200 g arhar dal', [], cat).some(f => raw.has(f.id)), 'no raw ingredients in AI hints');

// Your own food beats the catalogue for the same name.
const mine: Food = { id: 'mine-egg', name: 'Egg, boiled', aliases: ['boiled egg'], unit: 'g', kcal: 155, proteinG: 13, carbsG: 1, fatG: 11, fiberG: 0, servings: [{ label: 'egg', amount: 55 }] };
const own = matchText('2 boiled eggs', [mine], undefined, cat);
assert.ok(own.kind === 'all' && own.meals[0].foodId === 'mine-egg' && own.meals[0].grams === 110, 'My Foods wins');

// A catalogue food still logs when My Foods has something unrelated.
assert.equal(matchText('2 boiled eggs', [{ ...mine, id: 'x', name: 'Roti', aliases: [] }], undefined, cat).kind, 'all');
// Whole words only in AI hints: "price" is not rice.
assert.ok(!foodsFor('what is the price', [], cat).length);
// Bracketed serving labels still match what people type: "2 scoops" → "scoop (40 g)".
const whey = matchText('2 scoops alpha whey', [], undefined, cat);
assert.ok(whey.kind === 'all' && whey.meals[0].grams === 80, `scoop (40 g) × 2 = 80 g (${JSON.stringify(whey)})`);
// Nearest match first for AI hints: typos, aliases and size words count.
const top = (q: string) => nearestFoods(q, cat, 3).map(f => f.name);
assert.equal(top('kurkre masala munch')[0], 'Kurkure Masala Munch', 'one typo still finds it');
assert.equal(top('200 ml coke')[0], 'Coca-Cola', 'alias "coke" beats Diet Coke');
assert.match(top('farmhouse pizza medium')[0], /Farmhouse, Medium/, 'size words count');
assert.equal(top('dairy milk silk')[0], 'Cadbury Dairy Milk Silk', 'plain variant first');
assert.deepEqual(top('what is the price'), [], 'no weak matches');
// Generic words log a brand: the one you usually log, else the single best fit.
const pick = (q: string, prefer?: Map<string, number>) => { const r = matchText(q, [], undefined, cat, prefer); return r.kind === 'all' ? r.meals[0].name : null; };
assert.match(pick('1 lassi') ?? '', /^Amul Lassi/);
assert.match(pick('2 scoops whey') ?? '', /Alpha Whey/);
const slim = cat.find(f => f.name === 'Nandini Slim Skimmed Milk')!;
assert.match(pick('200 ml milk', new Map([[slim.id, 5]])) ?? '', /^Nandini Slim Skimmed Milk/, 'your usual milk wins');
// A bare count logs the smallest pack (the draft shows it, to change before Save).
assert.match(pick('1 pepsi') ?? '', /Pepsi × 1 \(200 ml\)/);
assert.match(pick('1 amul butter') ?? '', /\(10 g\)/);
// Raw items only when asked for: "chicken breast" is usually cooked.
assert.equal(pick('1 chicken breast'), null);
assert.ok(pick('200 g raw chicken breast'));
console.log('food-catalog: all checks passed');
