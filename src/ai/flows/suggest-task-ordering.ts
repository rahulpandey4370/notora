
'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting an optimal order for tasks to maximize productivity.
 *
 * - suggestTaskOrdering - A function that suggests an optimal order for tasks.
 * - SuggestTaskOrderingInput - The input type for the suggestTaskOrdering function.
 * - SuggestTaskOrderingOutput - The return type for the suggestTaskOrdering function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ModelId } from '@/lib/types';
import { callAzureOpenAI } from '@/lib/azure-openai';

const SuggestTaskOrderingInputSchema = z.object({
  tasks: z
    .array(z.string())
    .describe('An array of tasks to be ordered for optimal productivity.'),
});
export type SuggestTaskOrderingInput = z.infer<typeof SuggestTaskOrderingInputSchema>;

const SuggestTaskOrderingOutputSchema = z.object({
  orderedTasks: z
    .array(z.string())
    .describe('An array of tasks in the suggested optimal order.'),
  reasoning: z
    .string()
    .describe('The AI reasoning behind the suggested task order.'),
});
export type SuggestTaskOrderingOutput = z.infer<typeof SuggestTaskOrderingOutputSchema> & { modelId?: ModelId };

export async function suggestTaskOrdering(input: SuggestTaskOrderingInput, modelId: ModelId): Promise<SuggestTaskOrderingOutput> {
  const result = await suggestTaskOrderingFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an AI productivity assistant. Given the following list of tasks, suggest an optimal order for completing them to maximize productivity. Provide a brief reasoning for your suggested order.

Tasks:
{{#each tasks}}- {{{this}}}
{{/each}}`;

const suggestTaskOrderingFlow = ai.defineFlow(
  {
    name: 'suggestTaskOrderingFlow',
    inputSchema: SuggestTaskOrderingInputSchema,
    outputSchema: SuggestTaskOrderingOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-2.5-flash';
    let output;

    if (modelId === 'gpt-5.2-chat') {
      output = await callAzureOpenAI(promptTemplate, input, SuggestTaskOrderingOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'suggestTaskOrderingPrompt',
        input: {schema: SuggestTaskOrderingInputSchema},
        output: {schema: SuggestTaskOrderingOutputSchema},
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

    