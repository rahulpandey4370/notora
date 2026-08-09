
'use server';

/**
 * @fileOverview Generates a day-end summary of completed tasks and a motivational quote.
 *
 * - generateDayEndSummary - A function that generates the day-end summary.
 * - DayEndSummaryInput - The input type for the generateDayEndSummary function.
 * - DayEndSummaryOutput - The return type for the generateDayEndSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ModelId } from '@/lib/types';
import { callStructuredLLM } from '@/lib/ai-client';

const DayEndSummaryInputSchema = z.object({
  completedTasks: z.array(z.string()).describe('A list of completed tasks for the day.'),
});

export type DayEndSummaryInput = z.infer<typeof DayEndSummaryInputSchema>;

const DayEndSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the completed tasks.'),
  motivationalQuote: z.string().describe('A motivational quote to inspire the user.'),
});

export type DayEndSummaryOutput = z.infer<typeof DayEndSummaryOutputSchema> & { modelId?: ModelId };

export async function generateDayEndSummary(input: DayEndSummaryInput, modelId: ModelId): Promise<DayEndSummaryOutput> {
  const result = await dayEndSummaryFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are a cheerful and encouraging productivity assistant. Your goal is to make the user feel proud of what they've accomplished.

Generate a day-end summary based on the following completed tasks. Be positive, celebratory, and highlight their hard work.

Completed Tasks:
{{#each completedTasks}}
- {{{this}}}
{{/each}}

Based on these tasks, provide:
1. A short, uplifting summary of their accomplishments for the day.
2. A relevant and inspiring motivational quote.`;

const dayEndSummaryFlow = ai.defineFlow(
  {
    name: 'dayEndSummaryFlow',
    inputSchema: DayEndSummaryInputSchema,
    outputSchema: DayEndSummaryOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    // Provider routing lives in the unified client — this flow just
    // says what it wants and which model to use.
    output = await callStructuredLLM(
      modelId,
      promptTemplate,
      input,
      DayEndSummaryOutputSchema,
      'dayEndSummaryPrompt',
      DayEndSummaryInputSchema,
    );

    if (!output) {
      throw new Error("Flow failed to produce a valid output.");
    }
    return output;
  }
);

    