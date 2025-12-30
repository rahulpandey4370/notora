
'use server';

/**
 * @fileOverview Converts sticky note content into bullet points using AI.
 *
 * - bulletifyStickyNote - A function that converts text into bullet points.
 * - BulletifyStickyNoteInput - The input type for the bulletifyStickyNote function.
 * - BulletifyStickyNoteOutput - The return type for the bulletifyStickyNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ModelId } from '@/lib/types';
import { callAzureOpenAI } from '@/lib/azure-openai';

const BulletifyStickyNoteInputSchema = z.object({
  text: z.string().describe('The text content of the sticky note to bulletify.'),
});
export type BulletifyStickyNoteInput = z.infer<typeof BulletifyStickyNoteInputSchema>;

const BulletifyStickyNoteOutputSchema = z.object({
  bulletifiedText: z.string().describe('The bullet-point version of the input text.'),
});
export type BulletifyStickyNoteOutput = z.infer<typeof BulletifyStickyNoteOutputSchema> & { modelId?: ModelId };

export async function bulletifyStickyNote(input: BulletifyStickyNoteInput, modelId: ModelId): Promise<BulletifyStickyNoteOutput> {
  const result = await bulletifyStickyNoteFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `Convert the following text into a Markdown-formatted bulleted list.

Use "-" for bullet points.

Input Text:
{{{text}}}`;

const bulletifyStickyNoteFlow = ai.defineFlow(
  {
    name: 'bulletifyStickyNoteFlow',
    inputSchema: BulletifyStickyNoteInputSchema,
    outputSchema: BulletifyStickyNoteOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-2.5-flash';
    let output;

    if (modelId === 'gpt-5.2-chat') {
      output = await callAzureOpenAI(promptTemplate, input, BulletifyStickyNoteOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'bulletifyStickyNotePrompt',
        input: {schema: BulletifyStickyNoteInputSchema},
        output: {schema: BulletifyStickyNoteOutputSchema},
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

    