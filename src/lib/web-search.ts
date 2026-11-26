/**
 * Web search for the AI features, free first: Tavily (1,000 searches/month free with
 * TAVILY_API_KEY, no card), then OpenAI's built-in search (billed per search) if Tavily
 * is missing, out of quota or down. Returns null when neither works.
 */
import { requireUser } from '@/lib/session';
import { openAIWebSearch } from '@/lib/ai-client';

export type WebResult = { text: string; via: 'tavily' | 'openai' };

export async function searchWeb(query: string): Promise<WebResult | null> {
  await requireUser();
  const key = process.env.TAVILY_API_KEY;
  if (key) {
    try {
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ query, max_results: 5, search_depth: 'basic', include_answer: 'basic' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (r.ok) {
        const j = await r.json();
        const text = [j.answer, ...(j.results ?? []).map((x: any) => `- ${x.title}: ${String(x.content ?? '').slice(0, 400)}`)].filter(Boolean).join('\n');
        if (text.trim()) return { text, via: 'tavily' };
      } else console.warn('[web-search] Tavily failed with status', r.status);
    } catch (e: any) { console.warn('[web-search] Tavily failed:', e?.name ?? 'error'); }
  }
  try {
    const text = await openAIWebSearch(query);
    return text ? { text, via: 'openai' } : null;
  } catch (e: any) {
    console.warn('[web-search] OpenAI fallback failed with status', e?.status ?? 'unknown');
    return null;
  }
}
