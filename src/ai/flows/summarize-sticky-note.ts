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

const SummarizeStickyNoteInputSchema = z.object({
  content: z.string().describe('The content of the sticky note to summarize.'),
});
export type SummarizeStickyNoteInput = z.infer<typeof SummarizeStickyNoteInputSchema>;

const SummarizeStickyNoteOutputSchema = z.object({
  summary: z.string().describe('The summarized content of the sticky note.'),
});
export type SummarizeStickyNoteOutput = z.infer<typeof SummarizeStickyNoteOutputSchema>;

export async function summarizeStickyNote(input: SummarizeStickyNoteInput): Promise<SummarizeStickyNoteOutput> {
  return summarizeStickyNoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeStickyNotePrompt',
  input: {schema: SummarizeStickyNoteInputSchema},
  output: {schema: SummarizeStickyNoteOutputSchema},
  prompt: `Summarize the following sticky note content:

{{{content}}}
`,
});

const summarizeStickyNoteFlow = ai.defineFlow(
  {
    name: 'summarizeStickyNoteFlow',
    inputSchema: SummarizeStickyNoteInputSchema,
    outputSchema: SummarizeStickyNoteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
