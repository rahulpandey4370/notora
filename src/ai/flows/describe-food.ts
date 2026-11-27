'use server';
/**
 * "Add with AI" in My Foods: a food name (optionally a brand or a pasted
 * label) → nutrition per 100 g / 100 ml / 1 serving plus handy servings, for
 * the user to check and save once. Nothing is saved here.
 */
import { z } from 'genkit';
import { callStructuredLLM } from '@/lib/ai-client';
import type { ModelId } from '@/lib/types';
import type { Food } from '@/lib/food-match';
import { searchWeb } from '@/lib/web-search';

const OutputSchema = z.object({
  name: z.string().describe('Clean, specific name, e.g. "Steamed white rice", "Amul Gold milk", "Whole wheat roti"'),
  aliases: z.array(z.string()).describe('Other names the user might type, short and lowercase (e.g. "rice", "chawal")'),
  unit: z.enum(['g', 'ml', 'serving']).describe('"g" for solid foods and "ml" for drinks (values per 100); "serving" only for items always eaten whole and sold as one unit with no weight given (one bar, one packet)'),
  kcal: z.number().describe('Calories per 100 g / 100 ml / 1 serving'),
  proteinG: z.number(), carbsG: z.number(), fatG: z.number(), fiberG: z.number(),
  servings: z.array(z.object({ label: z.string().describe('e.g. "roti", "katori", "scoop", "glass", "piece"'), amount: z.number().describe('grams (or ml) in one of these') }))
    .describe('1 to 3 common Indian serving sizes in g/ml; empty when unit is "serving"'),
  note: z.string().describe('One short line on the source or assumption, e.g. "Per Amul label" or "Cooked weight, no oil"'),
});

const PROMPT = `You build a personal food database for a weight-loss tracker in India. The user wants to save this food once, with accurate nutrition:

"{{{food}}}"
{{#if webFacts}}
Web search results (prefer the official label for branded or packaged items):
{{{webFacts}}}
{{/if}}

Rules:
1. Give values per 100 g (solids) or per 100 ml (drinks). Use "serving" only for a single packaged unit without a stated weight (a bar, a sachet).
2. Plain staples are COOKED and as eaten (cooked rice, a roti as made at home) unless the user says raw or dry.
3. Be accurate, not optimistic: protein×4 + carbs×4 + fat×9 should be close to kcal.
4. servings: the sizes people in India actually use (1 roti ≈ 40 g, 1 katori ≈ 150 g, 1 scoop as on the label, 1 glass ≈ 250 ml, 1 medium banana ≈ 118 g).
5. If the user gave numbers (a pasted label), use them exactly.
6. No links or citation marks.`;

export type DescribedFood = Omit<Food, 'id'> & { note: string; web?: boolean };

export async function describeFood(food: string, modelId: ModelId, webSearch = false): Promise<DescribedFood> {
  const said = food.trim().slice(0, 400);
  if (!said) throw new Error('Name a food first.');
  const web = webSearch ? await searchWeb(`Nutrition facts per 100 g (calories, protein, carbs, fat, fibre) for: ${said}`) : null;
  const r = await callStructuredLLM(modelId, PROMPT, { food: said, webFacts: web?.text ?? '' }, OutputSchema, 'describeFoodPrompt');
  const n = (v: number) => (Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : 0);
  return {
    name: r.name.trim() || said, aliases: (r.aliases ?? []).map(a => a.trim()).filter(Boolean).slice(0, 6), unit: r.unit,
    kcal: Math.max(n(r.kcal), Math.round(n(r.proteinG) * 4 + n(r.carbsG) * 4 + n(r.fatG) * 9)),
    proteinG: n(r.proteinG), carbsG: n(r.carbsG), fatG: n(r.fatG), fiberG: n(r.fiberG),
    servings: r.unit === 'serving' ? [] : (r.servings ?? []).filter(s => s.label?.trim() && n(s.amount) > 0).slice(0, 3).map(s => ({ label: s.label.trim(), amount: n(s.amount) })),
    note: r.note, web: !!web,
  };
}
