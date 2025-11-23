'use server';
/**
 * @fileOverview An AI flow to analyze a journal entry and provide a thoughtful reflection.
 *
 * - reflectOnJournalEntry - A function that handles the journal reflection.
 * - ReflectOnJournalEntryInput - The input type for the function.
 * - ReflectOnJournalEntryOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReflectOnJournalEntryInputSchema = z.object({
  content: z.string().describe('The full text content of the journal entry.'),
});
export type ReflectOnJournalEntryInput = z.infer<typeof ReflectOnJournalEntryInputSchema>;

const ReflectOnJournalEntryOutputSchema = z.object({
  reflection: z.string().describe("The AI's thoughtful and empathetic reflection on the journal entry. This could include identifying key emotions, asking insightful questions, or highlighting recurring themes."),
});
export type ReflectOnJournalEntryOutput = z.infer<typeof ReflectOnJournalEntryOutputSchema>;

export async function reflectOnJournalEntry(input: ReflectOnJournalEntryInput): Promise<ReflectOnJournalEntryOutput> {
  return reflectOnJournalEntryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'reflectOnJournalEntryPrompt',
  input: { schema: ReflectOnJournalEntryInputSchema },
  output: { schema: ReflectOnJournalEntryOutputSchema },
  prompt: `You are an expert, empathetic life coach and therapist. Your task is to read the following journal entry and provide a short, insightful, and supportive reflection. Do not give advice unless it's framed as a gentle suggestion or question.

Your reflection should:
1.  Acknowledge the user's feelings and experiences in a compassionate way.
2.  Identify one or two key themes or emotions present in the entry (e.g., "It sounds like you're feeling a lot of pressure," or "I can sense a real feeling of accomplishment in your words.").
3.  Pose one gentle, open-ended question to encourage deeper self-reflection. (e.g., "What might a smaller, first step look like?" or "I wonder what it would feel like to let go of that expectation.").
4.  Keep the reflection to 2-4 sentences. It should be concise and easy to digest.

**Journal Entry:**
---
{{{content}}}
---

Provide your reflection in a supportive and non-judgmental tone.
`,
});

const reflectOnJournalEntryFlow = ai.defineFlow(
  {
    name: 'reflectOnJournalEntryFlow',
    inputSchema: ReflectOnJournalEntryInputSchema,
    outputSchema: ReflectOnJournalEntryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
