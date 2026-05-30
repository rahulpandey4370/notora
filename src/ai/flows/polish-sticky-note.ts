
'use server';

/**
 * @fileOverview AI flow to polish the content of a sticky note, making it more professional or presentable.
 *
 * - polishStickyNote - A function that handles the polishing of the sticky note content.
 * - PolishStickyNoteInput - The input type for the polishStickyNote function.
 * - PolishStickyNoteOutput - The return type for the polishStickyNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ModelId } from '@/lib/types';
import { callAzureOpenAI, AZURE_DEPLOYMENT_NAME } from '@/lib/azure-openai';

const PolishStickyNoteInputSchema = z.object({
  content: z.string().describe('The content of the sticky note to be polished.'),
});
export type PolishStickyNoteInput = z.infer<typeof PolishStickyNoteInputSchema>;

const PolishStickyNoteOutputSchema = z.object({
  polishedContent: z.string().describe('The polished content of the sticky note, with a heading and improved formatting.'),
});
export type PolishStickyNoteOutput = z.infer<typeof PolishStickyNoteOutputSchema> & { modelId?: ModelId };

export async function polishStickyNote(input: PolishStickyNoteInput, modelId: ModelId): Promise<PolishStickyNoteOutput> {
  const result = await polishStickyNoteFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an expert editor and formatter. Your task is to polish the following text from a sticky note to make it professional, clear, and well-organized.

Follow these steps:
1.  Read the content to understand its core message.
2.  Rewrite and restructure the main content for clarity and professionalism.
3.  Use appropriate Markdown formatting such as headings (e.g., "## Title"), bold text, italics, and lists (using "-").
4.  Correct any grammatical errors or awkward phrasing.
5.  The final output should be a single block of Markdown-formatted text.

Original Content:
{{{content}}}
`;

const polishStickyNoteFlow = ai.defineFlow(
  {
    name: 'polishStickyNoteFlow',
    inputSchema: PolishStickyNoteInputSchema,
    outputSchema: PolishStickyNoteOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    if (modelId === AZURE_DEPLOYMENT_NAME) {
      output = await callAzureOpenAI(promptTemplate, input, PolishStickyNoteOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'polishStickyNotePrompt',
        input: {schema: PolishStickyNoteInputSchema},
        output: {schema: PolishStickyNoteOutputSchema},
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

    