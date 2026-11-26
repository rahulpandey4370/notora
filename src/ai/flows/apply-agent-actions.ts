'use server';
/**
 * Applies changes the assistant proposed, only after the user tapped Confirm in the chat.
 * The list is re-validated here (never trusted from the client) and applied in one
 * versioned save, retried once if another device saved in between.
 */
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireUser } from '@/lib/session';
import { getAppData, saveAppData } from '@/lib/storage';
import { AgentActionSchema, applyActions } from '@/lib/agent-actions';
import { todayYmd } from '@/ai/adk/notora-agent';

export async function applyAgentActions(actions: unknown): Promise<{ applied: string[]; skipped: string[] }> {
  await requireUser();
  const parsed = z.array(AgentActionSchema).min(1).max(20).parse(actions);
  for (let attempt = 0; attempt < 2; attempt++) {
    const stored = await getAppData();
    if (!stored) throw new Error('No workspace yet.');
    const result = applyActions(stored.data, parsed, { today: todayYmd(), now: new Date().toISOString(), newId: uuidv4 });
    if (!result.applied.length) return { applied: [], skipped: result.skipped };
    const saved = await saveAppData(result.data, stored.version);
    if (saved.ok) return { applied: result.applied, skipped: result.skipped };
  }
  throw new Error('Your workspace kept changing on another device. Try again.');
}
