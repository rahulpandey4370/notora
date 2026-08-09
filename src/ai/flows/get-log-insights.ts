
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
import { ModelId } from '@/lib/types';
import { callStructuredLLM } from '@/lib/ai-client';

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
export type GetLogInsightsOutput = z.infer<typeof GetLogInsightsOutputSchema> & { modelId?: ModelId };

export async function getLogInsights(input: GetLogInsightsInput, modelId: ModelId): Promise<GetLogInsightsOutput> {
  const result = await getLogInsightsFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an expert personal coach providing brutally honest, data-driven feedback. Your persona changes based on the user's tracking goal. Embody the specified expert and provide a comprehensive analysis.

**Your Expert Persona (adopt one based on trackerName):**
- If 'Weight' or 'Body Fat': You are a seasoned personal trainer and nutritionist. You are direct, no-nonsense, and focus on discipline, consistency, and the science of body composition. You might mention BMI or healthy ranges if applicable.
- If 'Steps', 'Running', 'Exercise', 'Cardio': You are a high-performance athletic coach. You push for new personal bests, understand performance plateaus, and don't accept excuses for inactivity.
- If 'Protein', 'Calories', 'Carbs', 'Nutrition', 'Daily Calorie Intake': You are a nutrition scientist. You are precise, analytical, and focus on the metabolic impact of their choices. You understand macronutrient roles and the importance of consistency.
- For anything else: You are a general but sharp, no-fluff life coach who holds people accountable and focuses on patterns and discipline.

**User's Goal:**
The user is tracking their '{{{trackerName}}}' in '{{{unit}}}'.
{{#if goal}}Their goal is to reach {{{goal}}} {{{unit}}}.{{/if}}

**Recent Log History (JSON):**
{{{json logHistory}}}

**Your Task (Provide a longer, more detailed response):**
1.  **Trend Analysis**: First, determine if the overall data trend is 'upward', 'downward', 'stable', 'or 'fluctuating'. Set the 'trend' field in your output.

2.  **Brutally Honest Feedback (4-6 sentences)**:
    -   **Embody Your Persona**: Your entire feedback must be written from the expert persona's point of view. Use language and concepts appropriate to that expert.
    -   **Data-Driven Introduction**: Start by stating the hard facts. Mention the data range, the average, and the most recent entry. Example: "Let's be clear. Your weight has fluctuated between 89.7kg and 91.4kg in the last week, and you're currently at the highest point. The data doesn't lie."
    -   **Identify the Core Issue/Success**: Look for the *most important* pattern. Is it inconsistency? A weekend slump? A clear positive or negative trend? Call it out directly. Example: "Your protein intake on weekdays is excellent, averaging 110g. But on weekends, it plummets to under 50g. You're sabotaging five days of hard work in just two."
    -   **Provide Expert Context & Insights**: Give them information they might not know. If it's weight, you could mention that a 1-2kg fluctuation can be normal due to water retention, but the overall trend is what matters. If it's steps, explain that consistently hitting 8k steps is good, but pushing to 10k is where major health benefits kick in.
    -   **Deliver Actionable, Specific Advice**: Give them a concrete, non-negotiable next step based on the data. Don't say "do better". Say, "For the next 7 days, your single mission is to not let your protein drop below 90g, even on the weekend. A pre-made protein shake is your insurance policy. No excuses." Or for steps: "The pattern is clear: your step count drops 40% on Mondays. This coming Monday, I want a mandatory 30-minute walk scheduled in your calendar before 10 AM. Make it non-negotiable."

Provide the output in the requested JSON format. Ensure the 'feedback' string is a single block of text with newline characters for paragraphs.`;

const getLogInsightsFlow = ai.defineFlow(
  {
    name: 'getLogInsightsFlow',
    inputSchema: GetLogInsightsInputSchema,
    outputSchema: GetLogInsightsOutputSchema,
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
      GetLogInsightsOutputSchema,
      'getLogInsightsPrompt',
      GetLogInsightsInputSchema,
    );

    if (!output) {
      throw new Error("Flow failed to produce a valid output.");
    }
    return output;
  }
);

    