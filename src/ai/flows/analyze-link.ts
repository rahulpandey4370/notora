'use server';
/**
 * @fileOverview An AI flow to analyze a URL, classify it, and generate a summary.
 *
 * - analyzeLink - A function that handles the link analysis process.
 * - AnalyzeLinkInput - The input type for the analyzeLink function.
 * - AnalyzeLinkOutput - The return type for the analyzeLink function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { linkCategories } from '@/lib/types';

const AnalyzeLinkInputSchema = z.object({
  url: z.string().url().describe('The URL of the link to analyze.'),
});
export type AnalyzeLinkInput = z.infer<typeof AnalyzeLinkInputSchema>;

const AnalyzeLinkOutputSchema = z.object({
  title: z.string().describe('The title of the page from the URL.'),
  summary: z.string().describe('A short, one-line summary of the link’s content.'),
  category: z.enum(linkCategories).describe('The category of the link.'),
});
export type AnalyzeLinkOutput = z.infer<typeof AnalyzeLinkOutputSchema>;

export async function analyzeLink(input: AnalyzeLinkInput): Promise<AnalyzeLinkOutput> {
  return analyzeLinkFlow(input);
}

const AnalyzeLinkPromptInputSchema = z.object({
  url: z.string().url(),
  content: z.string(),
});

const prompt = ai.definePrompt({
  name: 'analyzeLinkPrompt',
  input: {schema: AnalyzeLinkPromptInputSchema},
  output: {schema: AnalyzeLinkOutputSchema},
  prompt: `Analyze the content of the webpage from the URL: {{{url}}}

Here is the text content of the page:
---
{{{content}}}
---

Based on the content, you must extract the following information:
1.  **Title**: The main title of the webpage.
2.  **Summary**: A concise, one-line summary of the content.
3.  **Category**: Classify the link into one of the following categories: ${linkCategories.join(', ')}.

Please provide the output in the requested JSON format.`,
});

const analyzeLinkFlow = ai.defineFlow(
  {
    name: 'analyzeLinkFlow',
    inputSchema: AnalyzeLinkInputSchema,
    outputSchema: AnalyzeLinkOutputSchema,
  },
  async (input) => {
    let content = '';
    try {
      const response = await fetch(input.url);
      const text = await response.text();
      // A simple way to strip HTML tags to reduce token count and noise.
      // This is a basic implementation and might not be perfect.
      content = text.replace(/<style[^>]*>.*<\/style>/gs, '')
                    .replace(/<script[^>]*>.*<\/script>/gs, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 15000); // Limit content to avoid exceeding token limits

    } catch (e) {
        console.error("Failed to fetch URL content", e);
        // If fetching fails, we can still try to let the model analyze it by URL alone.
    }
    
    const {output} = await prompt({ url: input.url, content });
    return output!;
  }
);
