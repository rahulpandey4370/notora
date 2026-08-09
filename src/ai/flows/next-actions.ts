'use server';
/**
 * @fileOverview Context-aware nudges for otherwise-empty surfaces.
 *
 * Empty states used to be dead ends ("No tasks scheduled for today."). This
 * turns them into a prompt for the single most useful next action, based on
 * what has actually gone stale in the user's data.
 *
 * - suggestNextActions - 2-3 concrete, data-grounded nudges.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ModelId } from '@/lib/types';
import { callStructuredLLM } from '@/lib/ai-client';

const NextActionsInputSchema = z.object({
  surface: z.string().describe('Which empty surface this is for: "tasks", "logs", "journal" or "dashboard".'),
  todayYmd: z.string(),
  staleTrackers: z.array(z.object({ name: z.string(), daysSinceLastLog: z.number() })).describe('Trackers not logged recently.'),
  overdueTaskTitles: z.array(z.string()).describe('Single tasks whose date has passed and are still incomplete.'),
  daysSinceLastJournal: z.number().nullish(),
  recurringTaskTitles: z.array(z.string()).describe('Recurring tasks that exist but were not completed today.'),
});
export type NextActionsInput = z.infer<typeof NextActionsInputSchema>;

const NextActionsOutputSchema = z.object({
  nudges: z.array(z.object({
    text: z.string().describe('One short sentence. Concrete and specific, citing the real name/number.'),
    action: z.enum(['log', 'task', 'journal', 'none']).describe('Which surface this nudge points at.'),
  })).describe('2-3 nudges, most useful first. Fewer is fine; never pad.'),
});
export type NextActionsOutput = z.infer<typeof NextActionsOutputSchema> & { modelId?: ModelId };

export async function suggestNextActions(input: NextActionsInput, modelId: ModelId): Promise<NextActionsOutput> {
  const result = await nextActionsFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `The user is looking at an empty "{{{surface}}}" screen. Suggest what is genuinely worth doing next, grounded ONLY in the data below. Today is {{{todayYmd}}}.

Trackers not logged recently:
{{#each staleTrackers}}- {{{this.name}}}: {{{this.daysSinceLastLog}}} days ago
{{/each}}

Overdue incomplete tasks:
{{#each overdueTaskTitles}}- {{{this}}}
{{/each}}

Recurring tasks not yet done today:
{{#each recurringTaskTitles}}- {{{this}}}
{{/each}}

Days since last journal entry: {{{daysSinceLastJournal}}}

Rules:
1. Name the actual tracker/task. "Weight hasn't been logged in 6 days" — not "log your metrics".
2. Prefer the most overdue / most stale item. Two or three nudges maximum.
3. If the data shows nothing genuinely stale or overdue, return an empty array. Do NOT invent busywork or generic motivation.
4. One short sentence each. No preamble, no encouragement filler.
`;

const nextActionsFlow = ai.defineFlow(
  {
    name: 'nextActionsFlow',
    inputSchema: NextActionsInputSchema,
    outputSchema: NextActionsOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    const output = await callStructuredLLM(
      modelId, promptTemplate, input, NextActionsOutputSchema, 'nextActionsPrompt', NextActionsInputSchema,
    );
    if (!output) throw new Error('Flow failed to produce a valid output.');
    return { nudges: (output.nudges ?? []).slice(0, 3) };
  }
);
