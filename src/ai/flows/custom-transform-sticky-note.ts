'use server';
/**
 * @fileOverview An AI flow to transform sticky note content based on a custom user prompt.
 *
 * - customTransformStickyNote - A function that handles the custom transformation.
 * - CustomTransformStickyNoteInput - The input type for the customTransformStickyNote function.
 * - CustomTransformStickyNoteOutput - The return type for the customTransformStickyNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CustomTransformStickyNoteInputSchema = z.object({
  content: z.string().describe('The original content of the sticky note.'),
  prompt: z.string().describe('The user-provided prompt detailing how to transform the content.'),
});
export type CustomTransformStickyNoteInput = z.infer<typeof CustomTransformStickyNoteInputSchema>;

const CustomTransformStickyNoteOutputSchema = z.object({
  transformedContent: z.string().describe('The content of the sticky note after applying the custom transformation.'),
});
export type CustomTransformStickyNoteOutput = z.infer<typeof CustomTransformStickyNoteOutputSchema>;

export async function customTransformStickyNote(input: CustomTransformStickyNoteInput): Promise<CustomTransformStickyNoteOutput> {
  return customTransformStickyNoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'customTransformStickyNotePrompt',
  input: {schema: CustomTransformStickyNoteInputSchema},
  output: {schema: CustomTransformStickyNoteOutputSchema},
  prompt: `You are an AI assistant that modifies text based on user instructions.
  
  User's instruction: "{{{prompt}}}"
  
  Apply this instruction to the following text:
  
  ---
  {{{content}}}
  ---
  
  Provide only the transformed text in your response.`,
});

const customTransformStickyNoteFlow = ai.defineFlow(
  {
    name: 'customTransformStickyNoteFlow',
    inputSchema: CustomTransformStickyNoteInputSchema,
    outputSchema: CustomTransformStickyNoteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
