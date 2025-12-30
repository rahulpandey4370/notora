
'use server';

/**
 * @fileOverview A flow to simplify the content of a sticky note using AI.
 *
 * - simplifyStickyNote - A function that handles the simplification process.
 * - SimplifyStickyNoteInput - The input type for the simplifyStickyNote function.
 * - SimplifyStickyNoteOutput - The return type for the simplifyStickyNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ModelId } from '@/lib/types';
import { callAzureOpenAI } from '@/lib/azure-openai';

const SimplifyStickyNoteInputSchema = z.object({
  text: z.string().describe('The text content of the sticky note to simplify.'),
});
export type SimplifyStickyNoteInput = z.infer<typeof SimplifyStickyNoteInputSchema>;

const SimplifyStickyNoteOutputSchema = z.object({
  simplifiedText: z.string().describe('The simplified text content of the sticky note.'),
});
export type SimplifyStickyNoteOutput = z.infer<typeof SimplifyStickyNoteOutputSchema> & { modelId?: ModelId };

export async function simplifyStickyNote(input: SimplifyStickyNoteInput, modelId: ModelId): Promise<SimplifyStickyNoteOutput> {
  const result = await simplifyStickyNoteFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an AI assistant that simplifies text to make it easier to understand. Rephrase the following text using simpler language.

Provide the output as plain text only, without any Markdown formatting.

Input Text:
{{{text}}}`;

const simplifyStickyNoteFlow = ai.defineFlow(
  {
    name: 'simplifyStickyNoteFlow',
    inputSchema: SimplifyStickyNoteInputSchema,
    outputSchema: SimplifyStickyNoteOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    if (modelId === 'gpt-5.2-chat') {
      output = await callAzureOpenAI(promptTemplate, input, SimplifyStickyNoteOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'simplifyStickyNotePrompt',
        input: {schema: SimplifyStickyNoteInputSchema},
        output: {schema: SimplifyStickyNoteOutputSchema},
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

    