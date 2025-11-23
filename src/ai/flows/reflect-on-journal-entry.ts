
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
  emotion: z.string().describe("The primary emotion detected in the entry (e.g., 'Joy', 'Frustration', 'Contentment')."),
  reflection: z.string().describe("The AI's thoughtful and empathetic reflection on the journal entry. This should acknowledge the user's feelings, highlight themes, and be supportive."),
  followUpQuestion: z.string().describe("An insightful, open-ended question to encourage deeper self-reflection from the user."),
});
export type ReflectOnJournalEntryOutput = z.infer<typeof ReflectOnJournalEntryOutputSchema>;

export async function reflectOnJournalEntry(input: ReflectOnJournalEntryInput): Promise<ReflectOnJournalEntryOutput> {
  return reflectOnJournalEntryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'reflectOnJournalEntryPrompt',
  input: { schema: ReflectOnJournalEntryInputSchema },
  output: { schema: ReflectOnJournalEntryOutputSchema },
  prompt: `You are an expert, empathetic life coach and therapist. Your task is to read the following journal entry and provide an insightful and supportive reflection. Do not give direct advice unless it's framed as a gentle suggestion.

Your response MUST follow this structure:
1.  **Detect Emotion**: Identify the primary emotion conveyed in the text (e.g., Joy, Frustration, Anxiety, Contentment, etc.). Set this in the 'emotion' field.
2.  **Write Reflection (2-3 sentences)**: Acknowledge the user's feelings and experiences in a compassionate way. Identify one or two key themes or tensions in the entry (e.g., "It sounds like you're navigating a conflict between your professional ambitions and your personal well-being," or "I can sense a real feeling of accomplishment and relief in your words today."). This goes in the 'reflection' field.
3.  **Pose Follow-up Question (1 sentence)**: Ask one gentle, open-ended question to encourage deeper self-reflection. This question should directly relate to the themes you identified. (e.g., "What might a smaller, first step toward that goal look like?" or "I wonder what it would feel like to let go of that expectation for just one day?"). This goes in the 'followUpQuestion' field.

**Journal Entry:**
---
{{{content}}}
---

Provide your response in a supportive, non-judgmental tone, adhering strictly to the JSON output format.`,
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
