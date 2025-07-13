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
  prompt: `You are a productivity assistant. Your task is to generate a day-end summary based on the completed tasks and provide a motivational quote.

Completed Tasks:
{{#each completedTasks}}
- {{{this}}}
{{/each}}

Summary:
{{summary}}

Motivational Quote:
{{motivationalQuote}}`,
});

const dayEndSummaryFlow = ai.defineFlow(
  {
    name: 'dayEndSummaryFlow',
    inputSchema: DayEndSummaryInputSchema,
    outputSchema: DayEndSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt({
      completedTasks: input.completedTasks,
      summary: '',
      motivationalQuote: '',
      prompt: `Generate a summary of the completed tasks and a motivational quote. The summary should be concise and highlight the accomplishments of the day. The motivational quote should be relevant to productivity and achieving goals.`,
    });

    return output!;
  }
);
