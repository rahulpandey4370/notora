
'use server';
/**
 * @fileOverview An AI flow for a contextual chatbot that understands the user's current page content.
 *
 * - contextualChat - A function that handles the chat conversation.
 * - ContextualChatInput - The input type for the contextualChat function.
 * - ContextualChatOutput - The return type for the contextualChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ModelId } from '@/lib/types';
import { callAzureOpenAI, AZURE_DEPLOYMENT_NAME } from '@/lib/azure-openai';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const ContextualChatInputSchema = z.object({
  history: z.array(ChatMessageSchema).describe('The history of the conversation so far.'),
  query: z.string().describe('The user\'s latest message or question.'),
  pageContext: z.string().describe('A JSON string representing the data and content of the current page the user is viewing. This provides the context for the conversation.'),
});
export type ContextualChatInput = z.infer<typeof ContextualChatInputSchema>;

const ContextualChatOutputSchema = z.object({
  response: z.string().describe('The AI\'s response to the user\'s query, based on the provided context and history.'),
});
export type ContextualChatOutput = z.infer<typeof ContextualChatOutputSchema> & { modelId?: ModelId };

export async function contextualChat(input: ContextualChatInput, modelId: ModelId): Promise<ContextualChatOutput> {
  const result = await contextualChatFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You are an intelligent assistant for the Notora productivity app. Your role is to help the user by answering questions based on the content of the page they are currently viewing.

You will be given the conversation history, the user's current query, and a JSON object representing the data on the current page. Use this page context to answer the user's questions accurately.

If the user asks a general question, answer it helpfully. If the question is about the data on the page, use the JSON context to formulate your answer.

**Conversation History:**
{{#each history}}
- {{role}}: {{{content}}}
{{/each}}

**Page Context (JSON Data):**
\`\`\`json
{{{pageContext}}}
\`\`\`

**User's New Query:**
"{{{query}}}"

Based on all this information, provide a helpful and concise response.`;

const contextualChatFlow = ai.defineFlow(
  {
    name: 'contextualChatFlow',
    inputSchema: ContextualChatInputSchema,
    outputSchema: ContextualChatOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';
    let output;

    if (modelId === AZURE_DEPLOYMENT_NAME) {
      output = await callAzureOpenAI(promptTemplate, input, ContextualChatOutputSchema);
    } else {
      const model = `googleai/${modelId}`;
      const prompt = ai.definePrompt({
        name: 'contextualChatPrompt',
        input: {schema: ContextualChatInputSchema},
        output: {schema: ContextualChatOutputSchema},
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

    