
'use server';
/**
 * @fileOverview An AI flow to summarize a journal entry into key points.
 *
 * - summarizeJournalEntry - A function that handles the summarization.
 * - SummarizeJournalEntryInput - The input type for the function.
 * - SummarizeJournalEntryOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ModelId } from '@/lib/types';
import { callStructuredLLM } from '@/lib/ai-client';

const SummarizeJournalEntryInputSchema = z.object({
  content: z.string().describe('The full text content of the journal entry.'),
});
export type SummarizeJournalEntryInput = z.infer<typeof SummarizeJournalEntryInputSchema>;

const SummarizeJournalEntryOutputSchema = z.object({
  summary: z.string().describe('A short, point-wise summary of the journal entry, formatted as a Markdown bulleted list.'),
});
export type SummarizeJournalEntryOutput = z.infer<typeof SummarizeJournalEntryOutputSchema> & { modelId?: ModelId };

export async function summarizeJournalEntry(input: SummarizeJournalEntryInput, modelId: ModelId): Promise<SummarizeJournalEntryOutput> {
  const result = await summarizeJournalEntryFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `Analyze the following journal entry and create a short, point-wise summary of its key topics and feelings.

**CRITICAL INSTRUCTIONS:**
1.  Read the entire entry to understand the main ideas.
2.  Extract the most important points.
3.  Format the summary as a Markdown bulleted list (using '-').
4.  The summary should be concise and capture the essence of the entry.

**Journal Entry:**
---
{{{content}}}
---

Provide the summary in the 'summary' field.`;

const summarizeJournalEntryFlow = ai.defineFlow(
  {
    name: 'summarizeJournalEntryFlow',
    inputSchema: SummarizeJournalEntryInputSchema,
    outputSchema: SummarizeJournalEntryOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    // Provider routing lives in the unified client — this flow just
    // says what it wants and which model to use.
    output = await callStructuredLLM(
      modelId,
      promptTemplate,
      input,
      SummarizeJournalEntryOutputSchema,
      'summarizeJournalEntryPrompt',
      SummarizeJournalEntryInputSchema,
    );

    if (!output) {
      throw new Error("Flow failed to produce a valid output.");
    }
    return output;
  }
);

    