
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
import { callStructuredLLM } from '@/lib/ai-client';

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
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    // Provider routing lives in the unified client — this flow just
    // says what it wants and which model to use.
    output = await callStructuredLLM(
      modelId,
      promptTemplate,
      input,
      BulletifyStickyNoteOutputSchema,
      'bulletifyStickyNotePrompt',
      BulletifyStickyNoteInputSchema,
    );

    if (!output) {
      throw new Error("Flow failed to produce a valid output.");
    }
    return output;
  }
);

    