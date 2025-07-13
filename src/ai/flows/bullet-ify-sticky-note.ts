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

const BulletifyStickyNoteInputSchema = z.object({
  text: z.string().describe('The text content of the sticky note to bulletify.'),
});
export type BulletifyStickyNoteInput = z.infer<typeof BulletifyStickyNoteInputSchema>;

const BulletifyStickyNoteOutputSchema = z.object({
  bulletifiedText: z.string().describe('The bullet-point version of the input text.'),
});
export type BulletifyStickyNoteOutput = z.infer<typeof BulletifyStickyNoteOutputSchema>;

export async function bulletifyStickyNote(input: BulletifyStickyNoteInput): Promise<BulletifyStickyNoteOutput> {
  return bulletifyStickyNoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'bulletifyStickyNotePrompt',
  input: {schema: BulletifyStickyNoteInputSchema},
  output: {schema: BulletifyStickyNoteOutputSchema},
  prompt: `Convert the following text into bullet points for better readability and organization:\n\n{{{text}}}`,
});

const bulletifyStickyNoteFlow = ai.defineFlow(
  {
    name: 'bulletifyStickyNoteFlow',
    inputSchema: BulletifyStickyNoteInputSchema,
    outputSchema: BulletifyStickyNoteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
