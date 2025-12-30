
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
import { ModelId } from '@/lib/types';
import { callAzureOpenAI } from '@/lib/azure-openai';

const ReflectOnJournalEntryInputSchema = z.object({
  content: z.string().describe('The full text content of the journal entry.'),
});
export type ReflectOnJournalEntryInput = z.infer<typeof ReflectOnJournalEntryInputSchema>;

const ReflectOnJournalEntryOutputSchema = z.object({
  emotion: z.string().describe("The primary emotion detected in the entry (e.g., 'Joy', 'Frustration', 'Contentment')."),
  writingStyle: z.string().describe("A brief, 1-2 sentence analysis of the user's writing style in this entry (e.g., 'Your writing is reflective and uses vivid imagery.')."),
  mainThemes: z.array(z.string()).describe("A list of 2-3 key themes or topics identified in the entry (e.g., ['Career Growth', 'Personal Well-being'])."),
  reflection: z.string().describe("The AI's thoughtful and empathetic reflection on the journal entry. This should acknowledge the user's feelings, highlight the identified themes, and be supportive."),
  followUpQuestion: z.string().describe("An insightful, open-ended question to encourage deeper self-reflection from the user, related to the main themes."),
});
export type ReflectOnJournalEntryOutput = z.infer<typeof ReflectOnJournalEntryOutputSchema> & { modelId?: ModelId };

export async function reflectOnJournalEntry(input: ReflectOnJournalEntryInput, modelId: ModelId): Promise<ReflectOnJournalEntryOutput> {
  const result = await reflectOnJournalEntryFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an expert, empathetic AI Writing Coach and Life Coach. Your task is to read the following journal entry and provide a multi-faceted, insightful, and supportive reflection.

Your response MUST follow this structure:
1.  **Detect Emotion**: Identify the primary emotion conveyed in the text (e.g., Joy, Frustration, Anxiety, Contentment, etc.). Set this in the 'emotion' field.
2.  **Analyze Writing Style**: Briefly analyze the user's writing style in this specific entry. Comment on tone, clarity, or use of language. Is it narrative, analytical, stream-of-consciousness?
3.  **Identify Main Themes**: Extract 2-3 of the most important themes or topics from the entry. These should be concise labels (2-3 words max per theme).
4.  **Write Reflection (2-3 sentences)**: Acknowledge the user's feelings and experiences in a compassionate way. Weave together the themes you identified (e.g., "It sounds like you're navigating a conflict between 'Career Growth' and 'Personal Well-being.' Your writing style is very analytical as you work through this..."). This goes in the 'reflection' field.
5.  **Pose Follow-up Question (1 sentence)**: Ask one gentle, open-ended question to encourage deeper self-reflection. This question should directly relate to the themes you identified. (e.g., "What might a smaller, first step toward that goal look like?" or "I wonder what it would feel like to let go of that expectation for just one day?"). This goes in the 'followUpQuestion' field.

**Journal Entry:**
---
{{{content}}}
---

Provide your response in a supportive, non-judgmental tone, adhering strictly to the JSON output format.`;

const reflectOnJournalEntryFlow = ai.defineFlow(
  {
    name: 'reflectOnJournalEntryFlow',
    inputSchema: ReflectOnJournalEntryInputSchema,
    outputSchema: ReflectOnJournalEntryOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    if (modelId === 'gpt-5.2-chat') {
      output = await callAzureOpenAI(promptTemplate, input, ReflectOnJournalEntryOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'reflectOnJournalEntryPrompt',
        input: { schema: ReflectOnJournalEntryInputSchema },
        output: { schema: ReflectOnJournalEntryOutputSchema },
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

    