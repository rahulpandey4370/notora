
'use server';
/**
 * @fileOverview An AI flow to perform a semantic search over a user's saved links.
 *
 * - searchLinks - A function that handles the link search process.
 * - SearchLinksInput - The input type for the searchLinks function.
 * - SearchLinksOutput - The return type for the searchLinks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { SavedLink, ModelId } from '@/lib/types';
import { callStructuredLLM } from '@/lib/ai-client';

const LinkSchema = z.object({
    id: z.string(),
    url: z.string().url(),
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    dateAdded: z.string().datetime(),
});

const SearchLinksInputSchema = z.object({
  query: z.string().describe('The user\'s natural language search query.'),
  links: z.array(LinkSchema).describe('The list of all saved links to search through.'),
});
export type SearchLinksInput = z.infer<typeof SearchLinksInputSchema>;

const SearchLinksOutputSchema = z.object({
  relevantLinkIds: z.array(z.string()).describe('An array of IDs of the links that are most relevant to the search query.'),
});
export type SearchLinksOutput = z.infer<typeof SearchLinksOutputSchema> & { modelId?: ModelId };

export async function searchLinks(input: SearchLinksInput, modelId: ModelId): Promise<SearchLinksOutput> {
  // If there are no links, return an empty array immediately.
  if (input.links.length === 0) {
    return { relevantLinkIds: [], modelId };
  }
  const result = await searchLinksFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an AI assistant that performs a semantic search. Your task is to find the most relevant links from a given list based on a user's natural language query.

Analyze the user's query for its meaning and intent, not just keywords. Then, examine the title and summary of each link to find the best matches.

User Query:
"{{{query}}}"

List of Saved Links (in JSON format):
{{{json links}}}

Based on your analysis, return an array of link IDs that are the most relevant to the user's query. The array should be ordered from most to least relevant. If no links are relevant, return an empty array.
`;

const searchLinksFlow = ai.defineFlow(
  {
    name: 'searchLinksFlow',
    inputSchema: SearchLinksInputSchema,
    outputSchema: SearchLinksOutputSchema,
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
      SearchLinksOutputSchema,
      'searchLinksPrompt',
      SearchLinksInputSchema,
    );

    if (!output) {
      throw new Error("Flow failed to produce a valid output.");
    }
    return output;
  }
);

    