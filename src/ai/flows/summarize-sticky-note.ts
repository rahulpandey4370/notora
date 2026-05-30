
'use server';
/**
 * @fileOverview An AI agent that summarizes sticky note content.
 *
 * - summarizeStickyNote - A function that summarizes the content of a sticky note.
 * - SummarizeStickyNoteInput - The input type for the summarizeStickyNote function.
 * - SummarizeStickyNoteOutput - The return type for the summarizeStickyNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ModelId } from '@/lib/types';
import { callAzureOpenAI, AZURE_DEPLOYMENT_NAME } from '@/lib/azure-openai';

const SummarizeStickyNoteInputSchema = z.object({
  content: z.string().describe('The content of the sticky note to summarize.'),
});
export type SummarizeStickyNoteInput = z.infer<typeof SummarizeStickyNoteInputSchema>;

const SummarizeStickyNoteOutputSchema = z.object({
  summary: z.string().describe('The summarized content of the sticky note.'),
});
export type SummarizeStickyNoteOutput = z.infer<typeof SummarizeStickyNoteOutputSchema> & { modelId?: ModelId };

export async function summarizeStickyNote(input: SummarizeStickyNoteInput, modelId: ModelId): Promise<SummarizeStickyNoteOutput> {
  const result = await summarizeStickyNoteFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `Summarize the following sticky note content. 
  
Provide the output as plain text only, without any Markdown formatting.

{{{content}}}
`;

const summarizeStickyNoteFlow = ai.defineFlow(
  {
    name: 'summarizeStickyNoteFlow',
    inputSchema: SummarizeStickyNoteInputSchema,
    outputSchema: SummarizeStickyNoteOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    if (modelId === AZURE_DEPLOYMENT_NAME) {
      output = await callAzureOpenAI(promptTemplate, input, SummarizeStickyNoteOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'summarizeStickyNotePrompt',
        input: {schema: SummarizeStickyNoteInputSchema},
        output: {schema: SummarizeStickyNoteOutputSchema},
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

    