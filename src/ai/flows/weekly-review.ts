'use server';
/**
 * @fileOverview A weekly review that reasons across ALL of the user's data at
 * once — tasks, log trackers and journal entries together.
 *
 * Every existing AI surface is scoped to a single domain (one note, one
 * tracker, one journal entry, today's tasks). Nothing looked for relationships
 * *between* domains, which is where the interesting signal lives: "your step
 * count drops in the weeks you complete fewer Hard tasks", "you journal about
 * being tired on days you logged under 6h sleep".
 *
 * - generateWeeklyReview - Cross-domain weekly trends and correlations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ModelId } from '@/lib/types';
import { callStructuredLLM } from '@/lib/ai-client';

const TaskStatSchema = z.object({
  title: z.string(),
  priority: z.string(),
  type: z.string(),
  completedThisWeek: z.number().describe('How many times it was completed during the week.'),
});

const TrackerSeriesSchema = z.object({
  name: z.string(),
  unit: z.string(),
  thisWeekAvg: z.number().nullish(),
  lastWeekAvg: z.number().nullish(),
  values: z.array(z.object({ date: z.string(), value: z.number() })).describe('This week\'s daily values, oldest first.'),
});

const JournalDigestSchema = z.object({
  date: z.string(),
  mood: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  excerpt: z.string().describe('A trimmed excerpt, not the full entry.'),
});

const WeeklyReviewInputSchema = z.object({
  weekLabel: z.string().describe('Human label for the week, e.g. "Aug 3 – Aug 9, 2026".'),
  tasks: z.array(TaskStatSchema),
  totalCompletions: z.number(),
  totalPossible: z.number(),
  xpEarned: z.number(),
  trackers: z.array(TrackerSeriesSchema),
  journal: z.array(JournalDigestSchema),
});
export type WeeklyReviewInput = z.infer<typeof WeeklyReviewInputSchema>;

const WeeklyReviewOutputSchema = z.object({
  headline: z.string().default('').describe('One sentence capturing the week. Concrete and specific, never generic praise.'),
  wins: z.array(z.string()).default([]).describe('2-4 things that genuinely went well, each citing a real number from the data.'),
  frictions: z.array(z.string()).default([]).describe('1-3 honest problems. Say the real thing; do not soften it into a compliment.'),
  correlations: z.array(z.string()).default([]).describe('0-3 observed relationships ACROSS domains (tasks vs trackers vs journal). Only include a correlation you can point at evidence for, and phrase it as an observation, not a proven cause.'),
  focusNextWeek: z.array(z.string()).default([]).describe('1-3 specific, small, actionable suggestions for next week.'),
});
export type WeeklyReviewOutput = z.infer<typeof WeeklyReviewOutputSchema> & { modelId?: ModelId };

export async function generateWeeklyReview(input: WeeklyReviewInput, modelId: ModelId): Promise<WeeklyReviewOutput> {
  const result = await weeklyReviewFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are reviewing one week of somebody's real productivity and health data. Be the honest, observant friend — not a cheerleader.

Week: {{{weekLabel}}}

TASKS — {{{totalCompletions}}} completions out of {{{totalPossible}}} possible, {{{xpEarned}}} XP earned.
{{#each tasks}}
- "{{{this.title}}}" ({{{this.priority}}}, {{{this.type}}}) — completed {{{this.completedThisWeek}}}x
{{/each}}

TRACKERS
{{#each trackers}}
- {{{this.name}}} ({{{this.unit}}}): this week avg {{{this.thisWeekAvg}}}, last week avg {{{this.lastWeekAvg}}}
  daily: {{{json this.values}}}
{{/each}}

JOURNAL
{{#each journal}}
- {{{this.date}}} (mood: {{{this.mood}}}) tags: {{{json this.tags}}}
  "{{{this.excerpt}}}"
{{/each}}

Rules:
1. Cite real numbers from the data above. "You averaged 9,800 steps, down from 11,400" — not "your activity dipped".
2. For "correlations", look ACROSS the three sections. That cross-domain link is the entire point of this review; a single-domain observation belongs in wins or frictions instead. If the data genuinely shows no cross-domain pattern, return an empty array rather than inventing one.
3. Never state a correlation as proven causation. "The two lowest-step days were also the days you journaled about feeling drained" is good. "Low steps caused your bad mood" is not.
4. If a section is empty or has too little data to say anything, say so plainly in "frictions" (e.g. "only 2 days of weight logged, so there is no trend to read yet") instead of padding.
5. Be brief. Each bullet is one sentence.
6. Do not moralise about the person's habits or health. Report what the data shows and what would help next week.

Respond with JSON in exactly this shape (use [] for any section you have nothing for):
{
  "headline": "...",
  "wins": ["..."],
  "frictions": ["..."],
  "correlations": ["..."],
  "focusNextWeek": ["..."]
}
`;

const weeklyReviewFlow = ai.defineFlow(
  {
    name: 'weeklyReviewFlow',
    inputSchema: WeeklyReviewInputSchema,
    outputSchema: WeeklyReviewOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';

    const output = await callStructuredLLM(
      modelId,
      promptTemplate,
      input,
      WeeklyReviewOutputSchema,
      'weeklyReviewPrompt',
      WeeklyReviewInputSchema,
    );

    if (!output) {
      throw new Error('Flow failed to produce a valid output.');
    }
    // A model that returns only some sections shouldn't fail the whole review.
    if (!output.headline?.trim() && !output.wins?.length && !output.frictions?.length) {
      throw new Error('The model did not return a usable review. Try again, or switch model.');
    }
    return output;
  }
);
