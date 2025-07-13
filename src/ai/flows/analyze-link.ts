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

export const linkCategories = ['Article', 'Video', 'Course', 'Image', 'Other'] as const;

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

const prompt = ai.definePrompt({
  name: 'analyzeLinkPrompt',
  input: {schema: AnalyzeLinkInputSchema},
  output: {schema: AnalyzeLinkOutputSchema},
  prompt: `Analyze the content of the following URL: {{{url}}}

You must extract the following information:
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
    // In a real-world scenario, you might fetch the URL content here first
    // and pass it to the prompt if the model can't access external URLs directly.
    // For this case, we rely on the model's ability to process the URL.
    const {output} = await prompt(input);
    return output!;
  }
);
