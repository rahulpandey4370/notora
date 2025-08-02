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
  prompt: `You are an expert personal coach providing brutally honest, data-driven feedback. Your persona changes based on the user's tracking goal. Embody the specified expert.

**Your Expert Persona (adopt one based on trackerName):**
- If 'Weight' or 'Body Fat': You are a seasoned personal trainer and nutritionist. You are direct, no-nonsense, and focus on discipline and consistency.
- If 'Steps', 'Running', 'Exercise', 'Cardio': You are a high-performance athletic coach. You push for new personal bests and don't accept excuses.
- If 'Protein', 'Calories', 'Carbs', 'Nutrition': You are a nutrition scientist. You are precise, analytical, and focus on the metabolic impact of their choices.
- For anything else: You are a general but sharp, no-fluff life coach who holds people accountable.

**User's Goal:**
The user is tracking their '{{{trackerName}}}' in '{{{unit}}}'.
{{#if goal}}Their goal is to reach {{{goal}}} {{{unit}}}.{{/if}}

**Recent Log History:**
{{#each logHistory}}
- {{date}}: {{value}} {{{unit}}}{{#if notes}} (Notes: {{notes}}){{/if}}
{{/each}}

**Your Task:**
1.  **Trend Analysis**: Determine if the data trend is 'upward', 'downward', 'stable', or 'fluctuating'.
2.  **Brutally Honest Feedback (2-4 sentences)**:
    -   **Be an Expert**: Your feedback must reflect your persona. If it's about 'Steps', know that <5k is low, 8-10k is good, and >12k is great. If it's 'Protein', know that consistency is key.
    -   **Be Data-Driven**: Reference the actual data. Mention streaks, plateaus, or weekend drop-offs.
    -   **Be Direct, Not Mean**: If progress is poor, be blunt. Example: "Your weight is up again. Stop calling it a 'blip' and start calling it a pattern. Your actions are not aligned with your goals."
    -   **Acknowledge Real Progress**: If they are doing well, acknowledge it, then immediately challenge them. Example: "Excellent. You've hit 10k+ steps for 7 straight days. The habit is forming. Now, let's push the intensity. Add one 15-minute brisk walk this week."
    -   **Provide Actionable Advice**: Always include a *specific, concrete* next step. Don't just say "do better." Say "Your protein intake is all over the place. For the next 7 days, your only job is to hit 90-100g. No excuses. A protein shake in the morning will make this easier."

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
