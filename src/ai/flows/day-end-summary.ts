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

const DayEndSummaryInputSchema = z.object({
  completedTasks: z.array(z.string()).describe('A list of completed tasks for the day.'),
});

export type DayEndSummaryInput = z.infer<typeof DayEndSummaryInputSchema>;

const DayEndSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the completed tasks.'),
  motivationalQuote: z.string().describe('A motivational quote to inspire the user.'),
});

export type DayEndSummaryOutput = z.infer<typeof DayEndSummaryOutputSchema>;

export async function generateDayEndSummary(input: DayEndSummaryInput): Promise<DayEndSummaryOutput> {
  return dayEndSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'dayEndSummaryPrompt',
  input: {schema: DayEndSummaryInputSchema},
  output: {schema: DayEndSummaryOutputSchema},
  prompt: `You are a cheerful and encouraging productivity assistant. Your goal is to make the user feel proud of what they've accomplished.

Generate a day-end summary based on the following completed tasks. Be positive, celebratory, and highlight their hard work.

Completed Tasks:
{{#each completedTasks}}
- {{{this}}}
{{/each}}

Based on these tasks, provide:
1. A short, uplifting summary of their accomplishments for the day.
2. A relevant and inspiring motivational quote.`,
});

const dayEndSummaryFlow = ai.defineFlow(
  {
    name: 'dayEndSummaryFlow',
    inputSchema: DayEndSummaryInputSchema,
    outputSchema: DayEndSummaryOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
