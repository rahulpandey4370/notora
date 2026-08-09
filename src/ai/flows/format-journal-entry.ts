
'use server';
/**
 * @fileOverview An AI flow to format a journal entry without changing content.
 *
 * - formatJournalEntry - A function that handles the formatting.
 * - FormatJournalEntryInput - The input type for the function.
 * - FormatJournalEntryOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ModelId } from '@/lib/types';
import { callStructuredLLM } from '@/lib/ai-client';

const FormatJournalEntryInputSchema = z.object({
  content: z.string().describe('The raw text content of the journal entry.'),
});
export type FormatJournalEntryInput = z.infer<typeof FormatJournalEntryInputSchema>;

const FormatJournalEntryOutputSchema = z.object({
  formattedContent: z.string().describe('The Markdown-formatted content of the journal entry.'),
});
export type FormatJournalEntryOutput = z.infer<typeof FormatJournalEntryOutputSchema> & { modelId?: ModelId };

export async function formatJournalEntry(input: FormatJournalEntryInput, modelId: ModelId): Promise<FormatJournalEntryOutput> {
  const result = await formatJournalEntryFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an expert text formatter. Your task is to format the following journal entry using Markdown.

**CRITICAL INSTRUCTIONS:**
1.  **DO NOT** change, rephrase, or add any words to the original content.
2.  Your only job is to add Markdown formatting like headings (##), bold (**text**), italics (*text*), and bullet points (-) to improve readability.
3.  Preserve the original language and phrasing exactly as it is.

**Original Journal Entry:**
---
{{{content}}}
---

Apply appropriate Markdown formatting based on the structure of the text and return it in the 'formattedContent' field.`;

const formatJournalEntryFlow = ai.defineFlow(
  {
    name: 'formatJournalEntryFlow',
    inputSchema: FormatJournalEntryInputSchema,
    outputSchema: FormatJournalEntryOutputSchema,
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
      FormatJournalEntryOutputSchema,
      'formatJournalEntryPrompt',
      FormatJournalEntryInputSchema,
    );

    if (!output) {
      throw new Error("Flow failed to produce a valid output.");
    }
    return output;
  }
);

    