
'use server';
/**
 * @fileOverview An AI flow to analyze a user's daily calorie balance.
 *
 * - analyzeDailyCalories - A function that handles the calorie analysis.
 * - AnalyzeDailyCaloriesInput - The input type for the analyzeDailyCalories function.
 * - AnalyzeDailyCaloriesOutput - The return type for the analyzeDailyCalories function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { callStructuredLLM } from '@/lib/ai-client';
import { ModelId } from '@/lib/types';

// Note: The TaskSchema is passed in but should NOT be used for calorie calculations.
const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(['Easy', 'Medium', 'Hard']),
  type: z.enum(['single', 'recurring', 'monthly', 'weekly']),
  completions: z.array(z.string()),
  createdAt: z.string(),
  date: z.string().optional(),
  month: z.string().optional(),
  week: z.string().optional(),
  carryForwardCount: z.number().optional(),
  originalXp: z.number().optional(),
});


const AnalyzeDailyCaloriesInputSchema = z.object({
  stats: z.object({
    age: z.number().describe("The user's age in years."),
    gender: z.enum(['male', 'female']).describe("The user's gender."),
    weight: z.number().describe("The user's weight in kilograms for the specified day."),
    height: z.number().describe("The user's height in centimeters."),
  }),
  tasks: z.array(TaskSchema).describe('A list of tasks completed on the given day. IMPORTANT: Do not use these tasks to calculate calorie burn. They are for context only.'),
  calorieIntake: z.number().describe('The total number of calories consumed by the user on the given day.'),
  steps: z.number().optional().describe('The total number of steps taken by the user on the given day.'),
  otherActivities: z.string().optional().describe('A free-form text description of any other physical activities completed (e.g., "30 minute run", "1 hour of weightlifting").'),
});
export type AnalyzeDailyCaloriesInput = z.infer<typeof AnalyzeDailyCaloriesInputSchema>;

const AnalyzeDailyCaloriesOutputSchema = z.object({
  maintenanceCalories: z.number().describe('The estimated Basal Metabolic Rate (BMR) or maintenance calories for a sedentary day.'),
  totalCalorieBurn: z.number().describe('The estimated Total Daily Energy Expenditure (TDEE) including calories burned from steps and other activities. This MUST be the sum of maintenanceCalories and the total activity burn calculated in the reasoning.'),
  netCalories: z.number().describe('The net calorie balance for the day (Calorie Intake - Total Calorie Burn). Positive for surplus, negative for deficit.'),
  summary: z.string().describe("A brief, one-sentence summary of the user's day (e.g., 'You were in a slight calorie deficit today.')."),
  reasoning: z.string().describe("A detailed step-by-step breakdown of the calculation process, explaining how BMR, step burn, and other activity burn were calculated."),
});
export type AnalyzeDailyCaloriesOutput = z.infer<typeof AnalyzeDailyCaloriesOutputSchema> & { modelId?: ModelId };

export async function analyzeDailyCalories(input: AnalyzeDailyCaloriesInput, modelId: ModelId): Promise<AnalyzeDailyCaloriesOutput> {
  const result = await analyzeDailyCaloriesFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an expert fitness and nutrition AI. Your task is to calculate a user's daily calorie balance based on their stats, activities, and food intake.

**CRITICAL INSTRUCTION:** Do NOT estimate calorie burn from the 'tasks' list. These are general life tasks and are not workouts. Only use the 'Steps' and 'Other Activities' fields for activity burn calculations.

**User Information:**
- Age: {{{stats.age}}}
- Gender: {{{stats.gender}}}
- Weight: {{{stats.weight}}} kg
- Height: {{{stats.height}}} cm
- Total Calorie Intake for the Day: {{{calorieIntake}}} kcal

**Activity Information:**
{{#if steps}}
**Steps Taken:** {{{steps}}}
{{/if}}

{{#if otherActivities}}
**Other Activities:** {{{otherActivities}}}
{{/if}}

**Your Calculation Steps:**

1.  **Calculate Basal Metabolic Rate (BMR):** Use the Mifflin-St Jeor equation:
    -   For men: BMR = 10 * weight (kg) + 6.25 * height (cm) - 5 * age (y) + 5
    -   For women: BMR = 10 * weight (kg) + 6.25 * height (cm) - 5 * age (y) - 161
    This is the user's maintenance calories for a day with no activity. Set the 'maintenanceCalories' output field to this value.

2.  **Estimate Activity-Based Calorie Burn (FROM STEPS AND ACTIVITIES ONLY):**
    -   **DO NOT** analyze the list of completed tasks for calorie burn. Ignore them for calculations.
    -   Analyze the 'Other Activities' text for workout details (e.g., "30 minute run", "1 hour of weightlifting"). Use standard metabolic equivalent (MET) values for estimation if possible. Be realistic. A 30-minute run for a 70kg person is about 300-400 kcal, not 1000.
    -   Calculate calories burned from steps. A common, reliable estimate is ~40-50 kcal per 1000 steps.
    -   Sum up the calories burned from 'Other Activities' and 'Steps'.

3.  **Calculate Total Daily Energy Expenditure (TDEE):**
    -   TDEE = BMR + Total Estimated Activity Burn (from steps and other activities only).
    -   Set the 'totalCalorieBurn' output field to this TDEE value. **This value must exactly match the final sum shown in your 'reasoning' field.**

4.  **Determine Net Calorie Balance:**
    -   Net Calories = Calorie Intake - TDEE.
    -   A positive value is a surplus. A negative value is a deficit.
    -   Set the 'netCalories' output field.

5.  **Generate a Summary:**
    -   Provide a brief, one-sentence summary based on the net calorie balance.

6.  **Provide Detailed Reasoning:**
    -   Create a step-by-step breakdown of your calculations for the 'reasoning' field.
    -   Start with the BMR calculation and its result.
    -   List the estimated calorie burn for each type of activity (Steps, Other Activities) and sum them up. **DO NOT MENTION TASKS IN THE REASONING.**
    -   Show the final TDEE calculation (BMR + Total Activity Burn).
    -   This should be a clear, human-readable explanation. Example: "1. BMR calculated as 1800 kcal. 2. Activity Burn: 200 kcal from 5000 steps + 350 kcal from 30 min run = 550 kcal. 3. Total Burn = 1800 + 550 = 2350 kcal."

Provide the final output in the requested JSON format. Ensure all numerical fields in the output are consistent with the final calculation in the 'reasoning' field.`;

const analyzeDailyCaloriesFlow = ai.defineFlow(
  {
    name: 'analyzeDailyCaloriesFlow',
    inputSchema: AnalyzeDailyCaloriesInputSchema,
    outputSchema: AnalyzeDailyCaloriesOutputSchema,
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
      AnalyzeDailyCaloriesOutputSchema,
      'analyzeDailyCaloriesPrompt',
      AnalyzeDailyCaloriesInputSchema,
    );

    if (!output) {
      throw new Error("Flow failed to produce a valid output.");
    }
    return output;
  }
);

    