// Run: npx tsx src/lib/food-match.check.ts
import assert from 'node:assert/strict';
import { matchText, parseSegment, perBasis, scaleFood, type Food } from './food-match';

const food = (p: Partial<Food> & Pick<Food, 'id' | 'name'>): Food => ({ aliases: [], unit: 'g', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, servings: [], ...p });
const rice = food({ id: 'rice', name: 'Steamed white rice', aliases: ['rice'], kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 });
const roti = food({ id: 'roti', name: 'Whole wheat roti', aliases: ['roti', 'chapati'], kcal: 300, proteinG: 10, carbsG: 55, fatG: 4, fiberG: 9, servings: [{ label: 'roti', amount: 40 }] });
const whey = food({ id: 'whey', name: 'Whey protein', kcal: 400, proteinG: 80, carbsG: 8, fatG: 6, fiberG: 0, servings: [{ label: 'scoop', amount: 32 }] });
const bar = food({ id: 'bar', name: 'Yoga Bar protein bar', unit: 'serving', kcal: 210, proteinG: 20, carbsG: 22, fatG: 7, fiberG: 5 });
const foods = [rice, roti, whey, bar];

// Amount parsing
assert.deepEqual(parseSegment('150g rice'), { name: 'rice', amount: { grams: 150 } });
assert.deepEqual(parseSegment('rice 470 gm'), { name: 'rice', amount: { grams: 470 } });
assert.deepEqual(parseSegment('0.2 kg paneer'), { name: 'paneer', amount: { grams: 200 } });
assert.deepEqual(parseSegment('2 rotis'), { name: 'roti', amount: { count: 2 } });
assert.deepEqual(parseSegment('half rice'), { name: 'rice', amount: { count: 0.5 } });

// Scaling: per 100 g, by serving, per-serving foods
const r150 = scaleFood(rice, { grams: 150 })!;
assert.equal(r150.kcal, 195);
assert.equal(r150.proteinG, 4.1);
assert.equal(r150.grams, 150);
assert.equal(scaleFood(roti, { count: 2 })!.kcal, 240, '2 × 40 g at 300/100 g');
assert.equal(scaleFood(bar, { count: 2 })!.kcal, 420);
assert.equal(scaleFood(bar, { grams: 50 }), null, 'grams of a per-serving food is unknown');

// Whole message from saved foods → no AI
const all = matchText('150g rice, 2 rotis and 1 scoop whey', foods, 'lunch');
assert.equal(all.kind, 'all');
if (all.kind === 'all') {
  assert.deepEqual(all.meals.map(m => m.foodId), ['rice', 'roti', 'whey']);
  assert.equal(all.meals[2].kcal, 128, '1 scoop = 32 g');
  assert.ok(all.meals.every(m => m.slot === 'lunch'));
}
assert.equal(matchText('protein bar', foods).kind, 'all', 'per-serving food with no amount = 1 serving');

// Must fall back to the AI
assert.equal(matchText('94.1 kg', foods).kind, 'partial', 'a weight is not a food');
assert.equal(matchText('2 rotis and dal', foods).kind, 'partial', 'dal is not saved');
assert.equal(matchText('2 rotis, 30 min jog', foods).kind, 'partial', 'workout in the message');
assert.equal(matchText('rice', foods).kind, 'partial', 'per-100 g food with no amount and no serving');
const twoRice = [...foods, food({ id: 'brown', name: 'Brown rice', aliases: ['rice'], kcal: 112 })];
const amb = matchText('150g rice', twoRice);
assert.equal(amb.kind, 'partial', 'two saved rices fit equally');
const partial = matchText('2 rotis and dal', foods);
assert.ok(partial.kind === 'partial' && partial.known.some(f => f.id === 'roti'), 'roti still passed to the AI');
assert.equal(matchText('anything', []).kind, 'partial', 'empty library');
// Corrections and unclear amounts are never guessed locally.
assert.equal(matchText('make it 3 rotis', foods).kind, 'partial', 'a correction, not a new roti');
assert.equal(matchText('delete the roti', foods).kind, 'partial');
assert.equal(matchText('roti 3', foods).kind, 'partial', 'a trailing number with no unit is unclear');
assert.equal(matchText('rice 300', foods).kind, 'partial');
assert.equal(matchText('150g brown rice', foods).kind, 'partial', 'only white rice is saved');
assert.equal(matchText('2 chapatis', foods).kind, 'all', 'an alias still works');

// Save to My Foods from a logged portion
assert.deepEqual(perBasis({ kcal: 195, proteinG: 4.05, carbsG: 42, fatG: 0.45, fiberG: 0.6 }, 150), { unit: 'g', kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 });
assert.equal(perBasis({ kcal: 210, proteinG: 20 }).unit, 'serving', 'no grams → one serving, never a guessed weight');
console.log('food-match: all checks passed');
