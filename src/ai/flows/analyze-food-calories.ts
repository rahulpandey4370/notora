
'use server';
/**
 * @fileOverview An AI flow to analyze a meal from an image or text and estimate calories.
 *
 * - analyzeFoodCalories - A function that handles the meal calorie analysis.
 * - AnalyzeFoodCaloriesInput - The input type for the analyzeFoodCalories function.
 * - AnalyzeFoodCaloriesOutput - The return type for the analyzeFoodCalories function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { callAzureOpenAI } from '@/lib/azure-openai';
import { ModelId } from '@/lib/types';

const AnalyzeFoodCaloriesInputSchema = z.object({
  foodImage: z.string().optional().describe("A photo of the food, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  foodDescription: z.string().optional().describe("A natural language description of the food eaten (e.g., '2 samosas and a cup of chai')."),
}).refine(data => data.foodImage || data.foodDescription, {
    message: "Either an image or a description of the food must be provided.",
});
export type AnalyzeFoodCaloriesInput = z.infer<typeof AnalyzeFoodCaloriesInputSchema>;


const AnalyzeFoodCaloriesOutputSchema = z.object({
  totalCalories: z.number().int().describe("The total estimated calories for the entire meal."),
  items: z.array(z.object({
    name: z.string().describe("The name of the identified food item."),
    calories: z.number().int().describe("The estimated calories for this specific item."),
  })).describe("A list of all food items identified in the meal and their individual calorie estimates."),
  reasoning: z.string().describe("A brief, one or two-sentence explanation of how the calorie estimate was derived, mentioning portion sizes or key ingredients considered."),
});
export type AnalyzeFoodCaloriesOutput = z.infer<typeof AnalyzeFoodCaloriesOutputSchema> & { modelId?: ModelId };

export async function analyzeFoodCalories(input: AnalyzeFoodCaloriesInput, modelId: ModelId): Promise<AnalyzeFoodCaloriesOutput> {
  const result = await analyzeFoodCaloriesFlow(input, { context: { modelId } });
  return { ...result, modelId };
}


const promptTemplate = `You are an expert nutritionist specializing in Indian cuisine. Your task is to accurately estimate the total calories in a meal based on a provided image and/or text description.

**User's Meal:**
{{#if foodDescription}}
**Description:** {{{foodDescription}}}
{{/if}}
{{#if foodImage}}
**Photo:** {{media url=foodImage}}
{{/if}}

**Your Task:**
1.  **Identify Food Items:** Carefully identify each distinct food item in the meal from the image and/or description.
2.  **Estimate Portion Sizes:** Based on visual cues (like comparison to the plate size) or text descriptions, estimate the portion size for each item (e.g., 1 bowl, 2 pieces, 150g). Be realistic.
3.  **Calculate Calories:** For each item, provide an accurate calorie estimate based on its ingredients and estimated portion size. Be very specific about Indian food items (e.g., distinguish between a plain roti and a butter naan).
4.  **Sum Total Calories:** Calculate the sum of calories for all identified items.
5.  **Provide Reasoning:** Briefly explain your estimation process, noting the portion sizes and food types you identified.

Provide the final output in the requested JSON format. Ensure the 'totalCalories' field is the exact sum of the calories in the 'items' array.`;

const analyzeFoodCaloriesFlow = ai.defineFlow(
  {
    name: 'analyzeFoodCaloriesFlow',
    inputSchema: AnalyzeFoodCaloriesInputSchema,
    outputSchema: AnalyzeFoodCaloriesOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-2.5-flash';
    let output;

    if (modelId === 'gpt-5.2-chat') {
      output = await callAzureOpenAI(promptTemplate, input, AnalyzeFoodCaloriesOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'analyzeFoodCaloriesPrompt',
        input: { schema: AnalyzeFoodCaloriesInputSchema },
        output: { schema: AnalyzeFoodCaloriesOutputSchema },
        prompt: promptTemplate,
      });
      const genkitResponse = await prompt(input, { model });
      output = genkitResponse.output;
    }

    if (!output) {
      throw new Error("Flow failed to produce a valid output.");
    }
    return output;
  }
);

    