'use server';
/**
 * The chat assistant. Runs on Google ADK (src/ai/adk/notora-agent.ts), so it can
 * look things up across the whole workspace and add tasks or notes when asked.
 */
import type { ModelId } from '@/lib/types';
import { requireUser } from '@/lib/session';
import { runNotoraAgent } from '@/ai/adk/notora-agent';
import type { ProposedAction } from '@/lib/agent-actions';

export type ContextualChatInput = {
  history: { role: 'user' | 'model'; content: string }[];
  query: string;
  pageContext: string;
  webSearch?: boolean;
};
export type ContextualChatOutput = { response: string; modelId?: ModelId; pending: ProposedAction[] };

export async function contextualChat(input: ContextualChatInput, modelId: ModelId): Promise<ContextualChatOutput> {
  await requireUser();
  const result = await runNotoraAgent({ ...input, modelKey: modelId || 'google::gemini-2.5-flash' });
  return { ...result, modelId };
}
