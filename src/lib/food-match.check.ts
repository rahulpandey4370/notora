// Run: npx tsx src/lib/food-match.check.ts
import assert from 'node:assert/strict';
import { amountOf, defaultAmount, guessAmount, joinMealName, openMealAmount, savedMealName, splitMealName, matchText, measuresFor, parseSegment, perBasis, perPieceTo100, rescaleMeal, scaleFood, type Food } from './food-match';

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
// A per-piece food converted with its weight: one piece keeps its numbers (±1%), and grams work too.
const bar100: Food = perPieceTo100({ ...bar, servings: [] }, 60, 'g', 'bar');
assert.equal(bar100.unit, 'g');
assert.equal(bar100.servings[0].label, 'bar');
assert.ok(Math.abs(scaleFood(bar100, { count: 1 })!.kcal - 210) <= 2, 'one bar is still ~210 kcal');
assert.equal(scaleFood(bar100, { grams: 30 })!.kcal, 105, 'half a bar by grams');

// Quantity + measure, shared by the food detail screen and meal editing.
const rotiF = food({ id: 'r', name: 'Whole wheat roti', kcal: 300, proteinG: 10, servings: [{ label: 'roti', amount: 40 }] });
const milkF = food({ id: 'm', name: 'Toned milk', unit: 'ml', kcal: 60, proteinG: 3, servings: [{ label: 'glass', amount: 200 }] });
const plainF = food({ id: 'p', name: 'Peanuts', kcal: 567, proteinG: 26 });
const pieceF = food({ id: 'x', name: 'Old bar', unit: 'serving', kcal: 210, proteinG: 20 });
assert.deepEqual(measuresFor(rotiF).map(m => m.id), ['s:roti', 'grams'], 'servings first, then weight');
assert.deepEqual(measuresFor(rotiF).map(m => m.label), ['roti (40 g)', 'g']);
assert.deepEqual(measuresFor(milkF).map(m => m.label), ['glass (200 ml)', 'ml']);
assert.deepEqual(measuresFor(pieceF).map(m => m.id), ['serving']);
assert.deepEqual(defaultAmount(rotiF), { unit: 's:roti', qty: 1 });
assert.deepEqual(defaultAmount(plainF), { unit: 'grams', qty: 100 });
assert.deepEqual(defaultAmount(pieceF), { unit: 'serving', qty: 1 });
assert.deepEqual(amountOf('grams', 80), { grams: 80 });
assert.deepEqual(amountOf('s:roti', 2), { count: 2, label: 'roti' });
assert.deepEqual(amountOf('serving', 1.5), { count: 1.5 });
// What a logged meal's amount was: a serving count only for the app's own "× n" names.
const two = scaleFood(rotiF, { count: 2, label: 'roti' })!;
assert.deepEqual(guessAmount(rotiF, two), { unit: 's:roti', qty: 2 });
assert.deepEqual(guessAmount(rotiF, scaleFood(rotiF, { grams: 150 })!), { unit: 'grams', qty: 150 });
assert.deepEqual(guessAmount(rotiF, { name: 'Whole wheat roti × 2 (90 g)', grams: 90 }), { unit: 'grams', qty: 90 }, '90 g is not a whole number of rotis');
assert.deepEqual(guessAmount(rotiF, { name: 'rotis from lunch' }), { unit: 's:roti', qty: 1 }, 'no weight known → the default');
// A meal with no known food: scale what was logged. 120 ml → 180 ml.
const chai = rescaleMeal({ name: 'Chai, 120 ml', kcal: 80, proteinG: 2, carbsG: 10, fatG: 3, fiberG: 0, grams: 120 }, 180 / 120);
assert.deepEqual(chai, { name: 'Chai, 180 ml', kcal: 120, proteinG: 3, carbsG: 15, fatG: 4.5, fiberG: 0, grams: 180 });
const noWeight = rescaleMeal({ name: 'Dal tadka', kcal: 200, proteinG: 9 }, 1.5);
assert.deepEqual(noWeight, { name: 'Dal tadka', kcal: 300, proteinG: 13.5 }, 'no weight: the numbers scale, nothing is invented');
assert.equal(rescaleMeal({ name: 'Paneer 25 g', kcal: 66, proteinG: 4.6, grams: 25 }, 80 / 25).name, 'Paneer 80 g');

// The edit screen shows a meal's name and its amount in separate fields: split the amount out of the name, join it back on save.
assert.deepEqual(splitMealName('Whole wheat roti × 2 (80 g)'), { base: 'Whole wheat roti', kind: 'x', qty: 2, grams: 80, unit: 'g' });
assert.deepEqual(splitMealName('Old bar × 2'), { base: 'Old bar', kind: 'x', qty: 2 });
assert.equal(joinMealName('Whole wheat roti', { kind: 'x', qty: 3, grams: 120, unit: 'g' }), 'Whole wheat roti × 3 (120 g)');
assert.deepEqual(splitMealName('Chai, 120 ml'), { base: 'Chai', kind: 'weight', qty: 120, unit: 'ml' });
assert.deepEqual(splitMealName('Paneer 25 g'), { base: 'Paneer', kind: 'weight', qty: 25, unit: 'g' });
assert.deepEqual(splitMealName('Amul Butter (10 g)'), { base: 'Amul Butter', kind: 'weight', qty: 10, unit: 'g' });
assert.deepEqual(splitMealName('Poha with peanuts, 1 plate'), { base: 'Poha with peanuts', kind: 'count', qty: 1, label: 'plate' });
assert.deepEqual(splitMealName('2 rotis'), { base: 'rotis', kind: 'lead', qty: 2 });
assert.deepEqual(splitMealName('5 Star chocolate'), { base: '5 Star chocolate', kind: 'none' }, 'a brand that starts with a number is not an amount');
assert.deepEqual(splitMealName('Maggi 2 minute noodles'), { base: 'Maggi 2 minute noodles', kind: 'none' });
assert.deepEqual(splitMealName('Dal tadka'), { base: 'Dal tadka', kind: 'none' });
assert.deepEqual(splitMealName('2 rotis, dal, sabzi'), { base: '2 rotis, dal, sabzi', kind: 'none' }, 'several things in one meal: the number is not the meal\'s amount');
assert.deepEqual(splitMealName('1 bowl dal and rice'), { base: '1 bowl dal and rice', kind: 'none' });
assert.equal(joinMealName('Chai', { kind: 'weight', qty: 180, unit: 'ml' }), 'Chai, 180 ml');
assert.equal(joinMealName('Poha with peanuts', { kind: 'count', qty: 1.5, label: 'plate' }), 'Poha with peanuts, 1.5 plate');
assert.equal(joinMealName('rotis', { kind: 'lead', qty: 3 }), '3 rotis');
assert.equal(joinMealName('Old bar', { kind: 'x', qty: 2 }), 'Old bar × 2');
assert.equal(joinMealName('Dal tadka', { kind: 'none' }), 'Dal tadka');
for (const name of ['Chai, 120 ml', 'Poha with peanuts, 1 plate', '2 rotis', 'Dal tadka', 'Whole wheat roti × 2 (80 g)', 'Old bar × 2']) { const p = splitMealName(name); assert.equal(joinMealName(p.base, p), name, 'unchanged amount → unchanged name'); }

// Opening a logged meal for editing, and the name it saves under. Found by review: every case below was wrong before.
const milk2 = food({ id: 'mk', name: 'Milk', unit: 'ml', kcal: 60, proteinG: 3 });
const barW = food({ id: 'bw', name: 'Protein bar', kcal: 350, proteinG: 33, servings: [{ label: 'bar', amount: 60 }] });
const same = (name: string, o: ReturnType<typeof openMealAmount>, f?: Food) => savedMealName(name, o, { name: o.name, unit: o.unit, qty: o.qty, amountChanged: false }, f);
// A rename that keeps the food's name as a prefix is still the user's name.
let o = openMealAmount({ name: 'Milk tea, 200 ml', kcal: 120, grams: 200 }, milk2);
assert.deepEqual([o.name, o.unit, o.qty, o.linked], ['Milk tea', 'grams', 200, true]);
assert.equal(same('Milk tea, 200 ml', o, milk2), 'Milk tea, 200 ml');
assert.equal(savedMealName('Milk tea, 200 ml', o, { name: 'Milk tea', unit: 'grams', qty: 300, amountChanged: true }, milk2), 'Milk tea, 300 ml');
o = openMealAmount({ name: 'Roti with ghee × 2 (80 g)', kcal: 240, grams: 80 }, rotiF);
assert.deepEqual([o.name, o.unit, o.qty], ['Roti with ghee', 's:roti', 2]);
assert.equal(same('Roti with ghee × 2 (80 g)', o, rotiF), 'Roti with ghee × 2 (80 g)');
// The app's own name shows as the food's name, and a new amount rewrites the suffix.
o = openMealAmount(two, rotiF);
assert.equal(o.name, 'Whole wheat roti');
assert.equal(savedMealName(two.name, o, { name: 'Whole wheat roti', unit: 's:roti', qty: 3, amountChanged: true }, rotiF), 'Whole wheat roti × 3 (120 g)');
// Numbers that no longer match the food (an AI edit left the weight stale): don't follow the food, read the amount off the name.
o = openMealAmount({ name: 'Whole wheat roti × 3 (120 g)', kcal: 360, grams: 80 }, rotiF);
assert.deepEqual([o.linked, o.unit, o.qty], [false, 'portion', 3]);
assert.equal(same('Whole wheat roti × 3 (120 g)', o, rotiF), 'Whole wheat roti × 3 (120 g)');
assert.equal(savedMealName('Whole wheat roti × 3 (120 g)', o, { name: o.name, unit: 'portion', qty: 4, amountChanged: true }), 'Whole wheat roti × 4 (160 g)');
// The name's weight wins over a stale stored one.
o = openMealAmount({ name: 'Paneer tikka, 200 g', kcal: 400, grams: 150 });
assert.deepEqual([o.name, o.unit, o.qty], ['Paneer tikka', 'grams', 200]);
// A linked meal with no stored weight: the count in its name, else the amount its calories imply; never the default.
o = openMealAmount({ name: 'Protein bar × 2', kcal: 420 }, barW);
assert.deepEqual([o.linked, o.unit, o.qty], [true, 's:bar', 2]);
assert.equal(same('Protein bar × 2', o, barW), 'Protein bar × 2');
o = openMealAmount({ name: 'Peanuts', kcal: 170 }, plainF);
assert.deepEqual([o.linked, o.unit, o.qty], [true, 'grams', 30]);
assert.equal(same('Peanuts', o, plainF), 'Peanuts');
// Saving untouched never rewrites a name; renaming keeps the amount exactly as it was written.
for (const name of ['Paneer (100 g)', 'Whey 30g', 'Oats, 0.75 cup', '2 rotis, dal, sabzi', 'Dal, rice, 2 rotis']) assert.equal(same(name, openMealAmount({ name, kcal: 200 })), name);
o = openMealAmount({ name: 'Paneer (100 g)', kcal: 265, grams: 100 });
assert.equal(savedMealName('Paneer (100 g)', o, { name: 'Paneer cubes', unit: o.unit, qty: o.qty, amountChanged: false }), 'Paneer cubes (100 g)');
assert.equal(joinMealName('Oats', { kind: 'count', qty: 0.75, label: 'cup' }), 'Oats, 0.75 cup', 'a quarter cup is not rounded away');
assert.deepEqual(splitMealName('Dal, rice, 2 rotis'), { base: 'Dal, rice, 2 rotis', kind: 'none' }, 'several things: the 2 counts only the rotis');
console.log('food-match: all checks passed');
