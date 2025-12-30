
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
import { linkCategories, ModelId } from '@/lib/types';
import { callAzureOpenAI } from '@/lib/azure-openai';

const AnalyzeLinkInputSchema = z.object({
  url: z.string().url().describe('The URL of the link to analyze.'),
});
export type AnalyzeLinkInput = z.infer<typeof AnalyzeLinkInputSchema>;

const AnalyzeLinkOutputSchema = z.object({
  title: z.string().describe('The title of the page from the URL.'),
  summary: z.string().describe('A short, one-line summary of the link’s content.'),
  category: z.enum(linkCategories).describe('The category of the link.'),
});
export type AnalyzeLinkOutput = z.infer<typeof AnalyzeLinkOutputSchema> & { modelId?: ModelId };

export async function analyzeLink(input: AnalyzeLinkInput, modelId: ModelId): Promise<AnalyzeLinkOutput> {
  const result = await analyzeLinkFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `Analyze the content of the webpage from the URL: {{{url}}}

Based on the content, you must extract the following information:
1.  **Title**: The main title of the webpage. If you can't find one, generate a suitable title based on the URL.
2.  **Summary**: A concise, one-line summary of the content.
3.  **Category**: Classify the link into one of the following categories: ${linkCategories.join(', ')}.

Please provide the output in the requested JSON format.`;

const analyzeLinkFlow = ai.defineFlow(
  {
    name: 'analyzeLinkFlow',
    inputSchema: AnalyzeLinkInputSchema,
    outputSchema: AnalyzeLinkOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    if (modelId === 'gpt-5.2-chat') {
      output = await callAzureOpenAI(promptTemplate, input, AnalyzeLinkOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'analyzeLinkPrompt',
        input: {schema: AnalyzeLinkInputSchema},
        output: {schema: AnalyzeLinkOutputSchema},
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

    