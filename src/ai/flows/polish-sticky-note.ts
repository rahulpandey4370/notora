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

const PolishStickyNoteInputSchema = z.object({
  content: z.string().describe('The content of the sticky note to be polished.'),
});
export type PolishStickyNoteInput = z.infer<typeof PolishStickyNoteInputSchema>;

const PolishStickyNoteOutputSchema = z.object({
  polishedContent: z.string().describe('The polished content of the sticky note.'),
});
export type PolishStickyNoteOutput = z.infer<typeof PolishStickyNoteOutputSchema>;

export async function polishStickyNote(input: PolishStickyNoteInput): Promise<PolishStickyNoteOutput> {
  return polishStickyNoteFlow(input);
}

const polishStickyNotePrompt = ai.definePrompt({
  name: 'polishStickyNotePrompt',
  input: {schema: PolishStickyNoteInputSchema},
  output: {schema: PolishStickyNoteOutputSchema},
  prompt: `You are an AI assistant that helps polish the content of sticky notes.

  Please refine the following content to make it more professional and presentable:

  {{{content}}}
  `,
});

const polishStickyNoteFlow = ai.defineFlow(
  {
    name: 'polishStickyNoteFlow',
    inputSchema: PolishStickyNoteInputSchema,
    outputSchema: PolishStickyNoteOutputSchema,
  },
  async input => {
    const {output} = await polishStickyNotePrompt(input);
    return output!;
  }
);
