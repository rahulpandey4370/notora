
'use server';
/**
 * @fileOverview An AI flow to generate a title for a sticky note.
 *
 * - generateNoteTitle - A function that handles the title generation.
 * - GenerateNoteTitleInput - The input type for the generateNoteTitle function.
 * - GenerateNoteTitleOutput - The return type for the generateNoteTitle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ModelId } from '@/lib/types';
import { callAzureOpenAI, AZURE_DEPLOYMENT_NAME } from '@/lib/azure-openai';

const GenerateNoteTitleInputSchema = z.object({
  content: z.string().describe('The content of the sticky note.'),
});
export type GenerateNoteTitleInput = z.infer<typeof GenerateNoteTitleInputSchema>;

const GenerateNoteTitleOutputSchema = z.object({
  title: z.string().describe('The generated title for the sticky note.'),
});
export type GenerateNoteTitleOutput = z.infer<typeof GenerateNoteTitleOutputSchema> & { modelId?: ModelId };

export async function generateNoteTitle(input: GenerateNoteTitleInput, modelId: ModelId): Promise<GenerateNoteTitleOutput> {
  const result = await generateNoteTitleFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `Based on the following note content, generate a short, descriptive title (5 words or less).
  
Provide only the title in your response.

Note Content:
---
{{{content}}}
---
`;

const generateNoteTitleFlow = ai.defineFlow(
  {
    name: 'generateNoteTitleFlow',
    inputSchema: GenerateNoteTitleInputSchema,
    outputSchema: GenerateNoteTitleOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    if (modelId === AZURE_DEPLOYMENT_NAME) {
      output = await callAzureOpenAI(promptTemplate, input, GenerateNoteTitleOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'generateNoteTitlePrompt',
        input: {schema: GenerateNoteTitleInputSchema},
        output: {schema: GenerateNoteTitleOutputSchema},
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

    