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

const SimplifyStickyNoteInputSchema = z.object({
  text: z.string().describe('The text content of the sticky note to simplify.'),
});
export type SimplifyStickyNoteInput = z.infer<typeof SimplifyStickyNoteInputSchema>;

const SimplifyStickyNoteOutputSchema = z.object({
  simplifiedText: z.string().describe('The simplified text content of the sticky note.'),
});
export type SimplifyStickyNoteOutput = z.infer<typeof SimplifyStickyNoteOutputSchema>;

export async function simplifyStickyNote(input: SimplifyStickyNoteInput): Promise<SimplifyStickyNoteOutput> {
  return simplifyStickyNoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'simplifyStickyNotePrompt',
  input: {schema: SimplifyStickyNoteInputSchema},
  output: {schema: SimplifyStickyNoteOutputSchema},
  prompt: `You are an AI assistant that simplifies text to make it easier to understand. Rephrase the following text using simpler language:\n\n{{{text}}}`,
});

const simplifyStickyNoteFlow = ai.defineFlow(
  {
    name: 'simplifyStickyNoteFlow',
    inputSchema: SimplifyStickyNoteInputSchema,
    outputSchema: SimplifyStickyNoteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
