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
import { TaskSchema } from '@/lib/types';

const AnalyzeDailyCaloriesInputSchema = z.object({
  stats: z.object({
    age: z.number().describe("The user's age in years."),
    gender: z.enum(['male', 'female']).describe("The user's gender."),
    weight: z.number().describe("The user's weight in kilograms."),
    height: z.number().describe("The user's height in centimeters."),
  }),
  tasks: z.array(TaskSchema).describe('A list of tasks completed on the given day.'),
  calorieIntake: z.number().describe('The total number of calories consumed by the user on the given day.'),
  steps: z.number().optional().describe('The total number of steps taken by the user on the given day.'),
  otherActivities: z.string().optional().describe('A free-form text description of any other physical activities completed.'),
});
export type AnalyzeDailyCaloriesInput = z.infer<typeof AnalyzeDailyCaloriesInputSchema>;

const AnalyzeDailyCaloriesOutputSchema = z.object({
  maintenanceCalories: z.number().int().describe('The estimated Basal Metabolic Rate (BMR) or maintenance calories for a sedentary day.'),
  totalCalorieBurn: z.number().int().describe('The estimated Total Daily Energy Expenditure (TDEE) including calories burned from tasks, steps, and other activities.'),
  netCalories: z.number().int().describe('The net calorie balance for the day (Calorie Intake - Total Calorie Burn). Positive for surplus, negative for deficit.'),
  summary: z.string().describe("A brief, one-sentence summary of the user's day (e.g., 'You were in a slight calorie deficit today.')."),
  reasoning: z.string().describe("A detailed step-by-step breakdown of the calculation process, explaining how BMR, task burn, step burn, and other activity burn were calculated."),
});
export type AnalyzeDailyCaloriesOutput = z.infer<typeof AnalyzeDailyCaloriesOutputSchema>;

export async function analyzeDailyCalories(input: AnalyzeDailyCaloriesInput): Promise<AnalyzeDailyCaloriesOutput> {
  return analyzeDailyCaloriesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeDailyCaloriesPrompt',
  input: { schema: AnalyzeDailyCaloriesInputSchema },
  output: { schema: AnalyzeDailyCaloriesOutputSchema },
  prompt: `You are an expert fitness and nutrition AI. Your task is to calculate a user's daily calorie balance based on their stats, activities, and food intake.

**User Information:**
- Age: {{{stats.age}}}
- Gender: {{{stats.gender}}}
- Weight: {{{stats.weight}}} kg
- Height: {{{stats.height}}} cm
- Total Calorie Intake for the Day: {{{calorieIntake}}} kcal

**Activity Information:**
{{#if tasks}}
**Tasks Completed Today:**
{{#each tasks}}
- "{{{title}}}" (Priority: {{{priority}}})
{{/each}}
{{/if}}

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

2.  **Estimate Activity-Based Calorie Burn:**
    -   Analyze the list of completed tasks. Use these general guidelines for tasks without clear context:
        - 'Easy' priority tasks: ~50-100 kcal
        - 'Medium' priority tasks: ~150-250 kcal
        - 'Hard' priority tasks: ~300-500 kcal
    -   Analyze the 'Other Activities' text for workout details (e.g., "30 minute run", "1 hour of weightlifting"). Use standard metabolic equivalent (MET) values for estimation if possible.
    -   Calculate calories burned from steps. A common estimate is ~40-50 kcal per 1000 steps.
    -   Sum up the calories burned from tasks, other activities, and steps.

3.  **Calculate Total Daily Energy Expenditure (TDEE):**
    -   TDEE = BMR + Total Estimated Activity Burn.
    -   Set the 'totalCalorieBurn' output field to this TDEE value.

4.  **Determine Net Calorie Balance:**
    -   Net Calories = Calorie Intake - TDEE.
    -   A positive value is a surplus. A negative value is a deficit.
    -   Set the 'netCalories' output field.

5.  **Generate a Summary:**
    -   Provide a brief, one-sentence summary based on the net calorie balance.

6.  **Provide Detailed Reasoning:**
    -   Create a step-by-step breakdown of your calculations for the 'reasoning' field.
    -   Start with the BMR calculation and its result.
    -   List the estimated calorie burn for each type of activity (Tasks, Steps, Other) and sum them up.
    -   Show the final TDEE calculation (BMR + Total Activity Burn).
    -   This should be a clear, human-readable explanation. Example: "1. BMR calculated as 1800 kcal. 2. Activity Burn: 150 kcal from tasks + 200 kcal from 5000 steps = 350 kcal. 3. Total Burn = 1800 + 350 = 2150 kcal."

Provide the final output in the requested JSON format.`,
});

const analyzeDailyCaloriesFlow = ai.defineFlow(
  {
    name: 'analyzeDailyCaloriesFlow',
    inputSchema: AnalyzeDailyCaloriesInputSchema,
    outputSchema: AnalyzeDailyCaloriesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
