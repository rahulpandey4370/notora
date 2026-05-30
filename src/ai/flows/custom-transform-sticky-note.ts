
'use server';
/**
 * @fileOverview An AI flow to transform sticky note content based on a custom user prompt.
 *
 * - customTransformStickyNote - A function that handles the custom transformation.
 * - CustomTransformStickyNoteInput - The input type for the customTransformStickyNote function.
 * - CustomTransformStickyNoteOutput - The return type for the customTransformStickyNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ModelId } from '@/lib/types';
import { callAzureOpenAI, AZURE_DEPLOYMENT_NAME } from '@/lib/azure-openai';

const CustomTransformStickyNoteInputSchema = z.object({
  content: z.string().describe('The original content of the sticky note.'),
  prompt: z.string().describe('The user-provided prompt detailing how to transform the content.'),
});
export type CustomTransformStickyNoteInput = z.infer<typeof CustomTransformStickyNoteInputSchema>;

const CustomTransformStickyNoteOutputSchema = z.object({
  transformedContent: z.string().describe('The content of the sticky note after applying the custom transformation.'),
});
export type CustomTransformStickyNoteOutput = z.infer<typeof CustomTransformStickyNoteOutputSchema> & { modelId?: ModelId };

export async function customTransformStickyNote(input: CustomTransformStickyNoteInput, modelId: ModelId): Promise<CustomTransformStickyNoteOutput> {
  const result = await customTransformStickyNoteFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an AI assistant that modifies text based on user instructions.
  
  User's instruction: "{{{prompt}}}"
  
  Apply this instruction to the following text:
  
  ---
  {{{content}}}
  ---
  
  Provide only the transformed, plain text in your response, without any Markdown formatting.`;

const customTransformStickyNoteFlow = ai.defineFlow(
  {
    name: 'customTransformStickyNoteFlow',
    inputSchema: CustomTransformStickyNoteInputSchema,
    outputSchema: CustomTransformStickyNoteOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    if (modelId === AZURE_DEPLOYMENT_NAME) {
      output = await callAzureOpenAI(promptTemplate, input, CustomTransformStickyNoteOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'customTransformStickyNotePrompt',
        input: {schema: CustomTransformStickyNoteInputSchema},
        output: {schema: CustomTransformStickyNoteOutputSchema},
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

    