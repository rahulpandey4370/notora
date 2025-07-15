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
  polishedContent: z.string().describe('The polished content of the sticky note, with a heading and improved formatting.'),
});
export type PolishStickyNoteOutput = z.infer<typeof PolishStickyNoteOutputSchema>;

export async function polishStickyNote(input: PolishStickyNoteInput): Promise<PolishStickyNoteOutput> {
  return polishStickyNoteFlow(input);
}

const polishStickyNotePrompt = ai.definePrompt({
  name: 'polishStickyNotePrompt',
  input: {schema: PolishStickyNoteInputSchema},
  output: {schema: PolishStickyNoteOutputSchema},
  prompt: `You are an expert editor and formatter. Your task is to polish the following text from a sticky note to make it professional, clear, and well-organized.

Follow these steps:
1.  Read the content to understand its core message.
2.  Create a short, descriptive, and fitting heading for the content. The heading should be on its own line and clearly separated from the body.
3.  Rewrite and restructure the main content for clarity and professionalism.
4.  Use appropriate formatting such as paragraphs for prose, numbered lists for sequential steps, or bullet points for distinct items.
5.  Correct any grammatical errors or awkward phrasing.
6.  The final output should be a single block of text containing the new heading and the polished, formatted content.

Original Content:
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
