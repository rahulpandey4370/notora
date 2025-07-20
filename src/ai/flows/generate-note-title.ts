'use server';
/**
 * @fileOverview An AI flow to generate a title for a sticky note.
 *
 * - generateNoteTitle - A function that handles the title generation.
 * - GenerateNoteTitleInput - The input type for the generateNoteTitle function.
 * - GenerateNoteTitleOutput - The return type for the generateNoteTitle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNoteTitleInputSchema = z.object({
  content: z.string().describe('The content of the sticky note.'),
});
export type GenerateNoteTitleInput = z.infer<typeof GenerateNoteTitleInputSchema>;

const GenerateNoteTitleOutputSchema = z.object({
  title: z.string().describe('The generated title for the sticky note.'),
});
export type GenerateNoteTitleOutput = z.infer<typeof GenerateNoteTitleOutputSchema>;

export async function generateNoteTitle(input: GenerateNoteTitleInput): Promise<GenerateNoteTitleOutput> {
  return generateNoteTitleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNoteTitlePrompt',
  input: {schema: GenerateNoteTitleInputSchema},
  output: {schema: GenerateNoteTitleOutputSchema},
  prompt: `Based on the following note content, generate a short, descriptive title (5 words or less).
  
Provide only the title in your response.

Note Content:
---
{{{content}}}
---
`,
});

const generateNoteTitleFlow = ai.defineFlow(
  {
    name: 'generateNoteTitleFlow',
    inputSchema: GenerateNoteTitleInputSchema,
    outputSchema: GenerateNoteTitleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
