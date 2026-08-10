import { PROVIDER_ORDER, type AIProvider } from './model-catalog';

/**
 * Which AI providers the model picker should offer — resolved on the SERVER.
 *
 * This used to be decided client-side from `NEXT_PUBLIC_AI_PROVIDERS`, which
 * has two problems on Vercel:
 *
 *  1. `NEXT_PUBLIC_*` values are inlined into the client bundle at BUILD time.
 *     If the variable isn't present for that build, the code silently falls
 *     back to google+azure — so adding ANTHROPIC_API_KEY / OPENAI_API_KEY has
 *     no effect on the picker at all.
 *  2. Marking a `NEXT_PUBLIC_*` var "Sensitive" is meaningless (it ships to the
 *     browser regardless) and gets in the way of that build-time inlining.
 *
 * Resolving here instead means the list is computed at request time from real
 * server env vars, which works with Vercel's Sensitive setting. By default we
 * simply offer whichever providers actually have credentials configured, so
 * adding a key is all you need to do — no second variable to remember.
 *
 * `AI_PROVIDERS` (or the legacy `NEXT_PUBLIC_AI_PROVIDERS`) still wins if set,
 * for when you want to hide a provider whose key exists.
 */
export function resolveEnabledProviders(): AIProvider[] {
  const raw = process.env.AI_PROVIDERS || process.env.NEXT_PUBLIC_AI_PROVIDERS;
  if (raw && raw.trim()) {
    const wanted = raw.split(',').map(s => s.trim().toLowerCase());
    const explicit = PROVIDER_ORDER.filter(p => wanted.includes(p));
    if (explicit.length) return explicit;
  }

  const hasKey: Record<AIProvider, boolean> = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    google: !!process.env.GEMINI_API_KEY,
    azure: !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT),
  };

  const detected = PROVIDER_ORDER.filter(p => hasKey[p]);
  // Never hand back an empty picker; fall back to the previous default.
  return detected.length ? detected : ['google', 'azure'];
}
