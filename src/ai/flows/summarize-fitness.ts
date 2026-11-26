'use server';
/**
 * The AI summary at the bottom of the Logs page: a period of daily numbers
 * (the same ones the page shows) → a short review with one suggestion.
 */
import { z } from 'genkit';
import { callStructuredLLM } from '@/lib/ai-client';
import type { ModelId } from '@/lib/types';

export type FitnessDayRow = {
  date: string; intakeKcal?: number; proteinG?: number; burnKcal?: number; steps?: number;
  sleepH?: number; restingHr?: number; weightKg?: number; hrvMs?: number; azm?: number; workouts?: string;
};
export type SummarizeFitnessInput = {
  from: string; to: string; rows: FitnessDayRow[];
  goals: { kcal?: number; proteinG?: number; steps?: number; weightKg?: number };
  trendWeightKg?: number; weeklyRateKg?: number;
};
export type SummarizeFitnessOutput = { headline: string; highlights: string[]; suggestion: string };

const OutputSchema = z.object({
  headline: z.string().describe('One sentence verdict on the period, with the key number'),
  highlights: z.array(z.string()).describe('3 to 5 short bullet points with concrete numbers: calories/deficit, protein, steps, sleep, weight trend, recovery'),
  suggestion: z.string().describe('One specific, doable suggestion for the next week'),
});

const PROMPT = `You are a supportive, evidence-based fitness coach reviewing someone's tracked data. Their goal is weight loss and general health. They live in India.

Period: {{{from}}} to {{{to}}}.
Targets: {{{goalsText}}}
Trend weight now: {{{trendText}}}

Daily data (blank = not tracked that day; burn is total calories burned; net = intake − burn):
{{{table}}}

Write a short review:
- Use averages over the days that have data; say how many days were tracked when it matters.
- Compare against the targets. Call out wins first, then the biggest gap.
- Be specific with numbers, no medical claims, no fluff.`;

const fmt = (v: number | undefined, dp = 0) => (v == null ? '' : dp ? v.toFixed(dp) : String(Math.round(v)));

export async function summarizeFitness(input: SummarizeFitnessInput, modelId: ModelId): Promise<SummarizeFitnessOutput> {
  const rows = input.rows.slice(-92); // a quarter at most keeps the prompt small
  const table = ['date | in kcal | protein g | burn kcal | net | steps | sleep h | RHR | weight kg | HRV ms | AZM | workouts',
    ...rows.map(r => [r.date, fmt(r.intakeKcal), fmt(r.proteinG), fmt(r.burnKcal),
      r.intakeKcal != null && r.burnKcal != null ? fmt(r.intakeKcal - r.burnKcal) : '',
      fmt(r.steps), fmt(r.sleepH, 1), fmt(r.restingHr), fmt(r.weightKg, 1), fmt(r.hrvMs, 1), fmt(r.azm), r.workouts ?? ''].join(' | '))].join('\n');
  const g = input.goals;
  const goalsText = [g.kcal && `${g.kcal} kcal/day intake`, g.proteinG && `${g.proteinG} g protein`, g.steps && `${g.steps} steps`, g.weightKg && `goal weight ${g.weightKg} kg`]
    .filter(Boolean).join(', ') || 'none set';
  const trendText = input.trendWeightKg != null
    ? `${input.trendWeightKg.toFixed(1)} kg${input.weeklyRateKg != null ? `, changing ${input.weeklyRateKg.toFixed(2)} kg/week` : ''}`
    : 'unknown';
  return callStructuredLLM(modelId, PROMPT, { from: input.from, to: input.to, goalsText, trendText, table }, OutputSchema, 'summarizeFitnessPrompt');
}
