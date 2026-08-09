'use server';
/**
 * @fileOverview Parses a single line of natural language into a structured task.
 *
 * Adding a task with a non-default date and priority previously meant a title
 * field plus three dropdown/popover round-trips. This flow lets the user type
 * "gym tomorrow 7am high priority" and get the same result in one action.
 *
 * - parseTask - Turns free text into title + type + priority + date.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ModelId } from '@/lib/types';
import { callStructuredLLM } from '@/lib/ai-client';

const ParseTaskInputSchema = z.object({
  naturalLanguageText: z.string().describe('The free-text task, e.g. "gym tomorrow 7am high priority".'),
  todayYmd: z.string().describe("Today's date as YYYY-MM-DD, in the user's own timezone."),
});
export type ParseTaskInput = z.infer<typeof ParseTaskInputSchema>;

const ParseTaskOutputSchema = z.object({
  title: z.string().describe('The task itself, with scheduling and priority words removed. Keep it natural and readable.'),
  priority: z.enum(['Easy', 'Medium', 'Hard']).describe('Effort/priority. Default to Medium when the text gives no signal.'),
  type: z.enum(['single', 'recurring', 'weekly', 'monthly']).describe('single = a one-off on a date; recurring = every day; weekly = every week; monthly = every month.'),
  date: z.string().nullish().describe('YYYY-MM-DD. Only for type "single" or "weekly". Null for recurring/monthly.'),
  reasoning: z.string().nullish().describe('One short clause explaining any non-obvious interpretation.'),
});
export type ParseTaskOutput = z.infer<typeof ParseTaskOutputSchema> & { modelId?: ModelId };

export async function parseTask(input: ParseTaskInput, modelId: ModelId): Promise<ParseTaskOutput> {
  const result = await parseTaskFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You turn a person's shorthand into one structured to-do.

Today's date (already in the user's timezone) is {{{todayYmd}}}.

Text to parse:
---
{{{naturalLanguageText}}}
---

Rules:
1. "title" is the action only. Strip scheduling words ("tomorrow", "every Monday", "on the 5th") and priority words ("high priority", "urgent", "easy win") out of it — they belong in the other fields. Do not strip words that carry real meaning ("morning gym session" keeps "morning" if it distinguishes the task).
2. Priority: "urgent"/"important"/"high"/"hard"/"big" -> Hard. "easy"/"quick"/"small"/"trivial" -> Easy. Anything else -> Medium.
3. Type:
   - "every day"/"daily"/"each morning" -> recurring
   - "every week"/"weekly"/"every Monday" -> weekly
   - "every month"/"monthly"/"on the 1st of each month" -> monthly
   - anything else, including a specific one-off date or no date at all -> single
4. Date: resolve relative expressions against {{{todayYmd}}} ("tomorrow", "next Friday", "in 3 days"). For a single task with no date stated, use {{{todayYmd}}}. Return null for recurring and monthly.
5. A time of day ("7am") does not change the date — keep it in the title if it is meaningful to the user.
6. Never invent detail that is not implied by the text.
`;

const parseTaskFlow = ai.defineFlow(
  {
    name: 'parseTaskFlow',
    inputSchema: ParseTaskInputSchema,
    outputSchema: ParseTaskOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';

    const output = await callStructuredLLM(
      modelId,
      promptTemplate,
      input,
      ParseTaskOutputSchema,
      'parseTaskPrompt',
      ParseTaskInputSchema,
    );

    if (!output) {
      throw new Error('Flow failed to produce a valid output.');
    }

    // Guard the fields the UI will trust directly.
    const validDate = output.date && /^\d{4}-\d{2}-\d{2}$/.test(output.date) ? output.date : null;
    const needsDate = output.type === 'single' || output.type === 'weekly';

    return {
      ...output,
      title: output.title.trim() || input.naturalLanguageText.trim(),
      date: needsDate ? (validDate ?? input.todayYmd) : null,
    };
  }
);
