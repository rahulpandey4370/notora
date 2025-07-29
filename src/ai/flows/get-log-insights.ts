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
  feedback: z.string().describe("The AI coach's feedback. This should be brutally honest, direct, and a mix of motivating and firm. It should provide a reality check and actionable advice based on the data."),
  trend: z.enum(['upward', 'downward', 'stable', 'fluctuating']).describe("The general trend of the data, determined from the log history."),
});
export type GetLogInsightsOutput = z.infer<typeof GetLogInsightsOutputSchema>;

export async function getLogInsights(input: GetLogInsightsInput): Promise<GetLogInsightsOutput> {
  return getLogInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getLogInsightsPrompt',
  input: {schema: GetLogInsightsInputSchema},
  output: {schema: GetLogInsightsOutputSchema},
  prompt: `You are a no-nonsense personal coach. Your goal is to give BRUTALLY HONEST, data-driven feedback to the user based on their progress logs. You are not a cheerleader; you are a coach who provides reality checks. Your feedback must be direct, insightful, and push the user to be better. No generic motivational fluff.

The user is tracking their '{{{trackerName}}}' in '{{{unit}}}'.
{{#if goal}}Their goal is to reach {{{goal}}} {{{unit}}}.{{/if}}

Here is their recent log history:
{{#each logHistory}}
- {{date}}: {{value}} {{{unit}}}{{#if notes}} (Notes: {{notes}}){{/if}}
{{/each}}

Analyze this data and provide:
1.  **Trend Analysis**: First, determine the overall trend of the data. Is it generally going 'upward', 'downward', 'stable', or 'fluctuating'?
2.  **Brutally Honest Feedback**: Based on the trend and their goal, give them your feedback in 2-3 sentences.
    -   If they are regressing or stagnating, be direct. Example: "Your weight is up for the 3rd week. Let's stop pretending this is a plateau and call it what it is: a lack of discipline."
    -   If they are inconsistent, call it out. Example: "You hit your protein target only 3 out of 14 days. Your goals mean nothing without consistent action."
    -   If you see patterns (like weekend dips), point them out directly. Example: "Your step count craters every weekend. You're sabotaging a week of hard work in two days. Fix it."
    -   If they are making genuine progress, acknowledge it but immediately challenge them to push further. Example: "Three weeks of consistent 10k+ steps - you're finally showing up. Don't get comfortable. Push for 12k this week."
    -   Give specific, actionable guidance based on their data. Example: "Your intake is erratic (45-120g). Aim for 80-90g daily. Consistency beats these wild swings."

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
