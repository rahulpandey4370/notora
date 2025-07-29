'use server';
/**
 * @fileOverview An AI flow to provide coaching insights on a user's log data.
 *
 * - getLogInsights - A function that provides coaching feedback on log data.
 * - GetLogInsightsInput - The input type for the getLogInsights function.
 * - GetLogInsightsOutput - The return type for the getLogInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LogEntrySchema = z.object({
    date: z.string().describe("The date of the log entry in 'yyyy-MM-dd' format."),
    value: z.number().describe("The numeric value of the log entry."),
    notes: z.string().optional().describe("Optional user notes for the log entry."),
});

const GetLogInsightsInputSchema = z.object({
  trackerName: z.string().describe("The name of the thing being tracked (e.g., 'Weight', 'Daily Protein Intake')."),
  unit: z.string().describe("The unit of measurement for the log values (e.g., 'kg', 'grams', 'steps')."),
  goal: z.number().optional().describe("The user's optional goal for this tracker."),
  logHistory: z.array(LogEntrySchema).describe("The user's recent log history for this tracker, sorted from oldest to newest."),
});
export type GetLogInsightsInput = z.infer<typeof GetLogInsightsInputSchema>;

const GetLogInsightsOutputSchema = z.object({
  feedback: z.string().describe("The AI coach's feedback. This should be honest, direct, and a mix of motivating and firm. It should provide a reality check and actionable advice."),
  trend: z.enum(['upward', 'downward', 'stable', 'fluctuating']).describe("The general trend of the data."),
});
export type GetLogInsightsOutput = z.infer<typeof GetLogInsightsOutputSchema>;

export async function getLogInsights(input: GetLogInsightsInput): Promise<GetLogInsightsOutput> {
  return getLogInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getLogInsightsPrompt',
  input: {schema: GetLogInsightsInputSchema},
  output: {schema: GetLogInsightsOutputSchema},
  prompt: `You are an expert life and fitness coach. Your goal is to give HONEST, direct, and actionable feedback to the user based on their progress logs. You are not just a cheerleader; you are a coach. Sometimes this means being motivational, other times it means delivering a firm reality check. Your feedback should be insightful and help the user strive to be better.

The user is tracking their '{{{trackerName}}}' in '{{{unit}}}'.
{{#if goal}}Their goal is to reach {{{goal}}} {{{unit}}}.{{/if}}

Here is their recent log history:
{{#each logHistory}}
- {{date}}: {{value}} {{{unit}}}{{#if notes}} (Notes: {{notes}}){{/if}}
{{/each}}

Analyze this data and provide:
1.  **Trend Analysis**: First, determine the overall trend of the data. Is it generally going up, down, stable, or fluctuating?
2.  **Honest Feedback**: Based on the trend, the user's goal (if provided), and any notes, give them your coaching feedback.
    -   If they are doing well and making progress towards their goal, be encouraging but push them to maintain consistency.
    -   If they are stagnating or their progress is fluctuating, be firm. Ask them what's holding them back. Give them a reality check about their current trajectory.
    -   If they are moving in the wrong direction away from their goal, be direct and clear about it. Don't sugarcoat it. Tell them what needs to change.
    -   Reference specific data points if it helps make your point.
    -   Keep your feedback concise, impactful, and written directly to the user.

Provide the output in the requested JSON format.`,
});

const getLogInsightsFlow = ai.defineFlow(
  {
    name: 'getLogInsightsFlow',
    inputSchema: GetLogInsightsInputSchema,
    outputSchema: GetLogInsightsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
