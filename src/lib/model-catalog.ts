/**
 * Curated catalog of the AI models Notora can talk to.
 *
 * This module is imported on the client (the model picker lives in the header),
 * so it must contain NO secrets — only ids, labels, and public pricing.
 *
 * WHICH PROVIDERS APPEAR: the picker shows a provider's models when that
 * provider is listed in `NEXT_PUBLIC_AI_PROVIDERS`. That follows the pattern
 * already used here for `NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME` — the
 * client needs to know what to offer, and real API keys must stay server-side.
 *
 *   NEXT_PUBLIC_AI_PROVIDERS=google,anthropic,openai,azure
 *
 * The matching server-side key must also be set, or calls fail with a clear
 * error naming the missing variable.
 */

export type AIProvider = 'google' | 'openai' | 'anthropic' | 'azure';

/** Shown as a pill in the picker so the tradeoff is visible at a glance. */
export type ModelTag = 'flagship' | 'balanced' | 'cheap' | 'fast' | 'reasoning' | 'legacy';

export interface CatalogModel {
  /** Provider-qualified unique id — the value the picker stores. */
  key: string;
  /** The id sent to the provider's API. Not unique across providers. */
  id: string;
  provider: AIProvider;
  label: string;
  tags: ModelTag[];
  /** USD per million input / output tokens, where published. */
  inputPerMTok?: number;
  outputPerMTok?: number;
  contextWindow?: number;
  notes?: string;
}

const AZURE_DEPLOYMENT = process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt-5.4';

/** Anthropic — ids, pricing and context per the Claude platform docs. */
export const ANTHROPIC_MODELS: CatalogModel[] = [
  { key: 'anthropic::claude-opus-5', id: 'claude-opus-5', provider: 'anthropic',
    label: 'Claude Opus 5', tags: ['flagship', 'reasoning'],
    inputPerMTok: 5, outputPerMTok: 25, contextWindow: 1_000_000,
    notes: 'Best for long-form reflection and deep summaries.' },
  { key: 'anthropic::claude-sonnet-5', id: 'claude-sonnet-5', provider: 'anthropic',
    label: 'Claude Sonnet 5', tags: ['balanced'],
    inputPerMTok: 3, outputPerMTok: 15, contextWindow: 1_000_000,
    notes: 'Near-Opus quality at lower cost. Good default.' },
  { key: 'anthropic::claude-haiku-4-5', id: 'claude-haiku-4-5', provider: 'anthropic',
    label: 'Claude Haiku 4.5', tags: ['cheap', 'fast'],
    inputPerMTok: 1, outputPerMTok: 5, contextWindow: 200_000,
    notes: 'Cheapest and fastest — ideal for note titles and quick transforms.' },
  { key: 'anthropic::claude-opus-4-8', id: 'claude-opus-4-8', provider: 'anthropic',
    label: 'Claude Opus 4.8', tags: ['reasoning'],
    inputPerMTok: 5, outputPerMTok: 25, contextWindow: 1_000_000,
    notes: 'Previous-generation Opus.' },
  { key: 'anthropic::claude-fable-5', id: 'claude-fable-5', provider: 'anthropic',
    label: 'Claude Fable 5', tags: ['flagship', 'reasoning'],
    inputPerMTok: 10, outputPerMTok: 50, contextWindow: 1_000_000,
    notes: 'Most capable, highest cost. Requires 30-day data retention.' },
];

/** OpenAI — first-party API (not Azure). */
export const OPENAI_MODELS: CatalogModel[] = [
  { key: 'openai::gpt-5.6-sol', id: 'gpt-5.6-sol', provider: 'openai',
    label: 'GPT-5.6 Sol', tags: ['flagship', 'reasoning'],
    inputPerMTok: 5, outputPerMTok: 30, contextWindow: 1_050_000,
    notes: 'Current flagship.' },
  { key: 'openai::gpt-5.6-terra', id: 'gpt-5.6-terra', provider: 'openai',
    label: 'GPT-5.6 Terra', tags: ['balanced'],
    inputPerMTok: 2, outputPerMTok: 12, contextWindow: 1_050_000,
    notes: 'Balanced tier. Good default.' },
  { key: 'openai::gpt-5.6-luna', id: 'gpt-5.6-luna', provider: 'openai',
    label: 'GPT-5.6 Luna', tags: ['cheap', 'fast'],
    inputPerMTok: 0.2, outputPerMTok: 1.2, contextWindow: 1_050_000,
    notes: 'Cheapest and fastest.' },
  { key: 'openai::gpt-5.5-pro', id: 'gpt-5.5-pro', provider: 'openai',
    label: 'GPT-5.5 Pro', tags: ['reasoning'],
    inputPerMTok: 30, outputPerMTok: 180, contextWindow: 272_000,
    notes: 'Very high cost. Hardest one-off analysis only.' },
  { key: 'openai::gpt-5.5', id: 'gpt-5.5', provider: 'openai',
    label: 'GPT-5.5', tags: ['legacy'],
    inputPerMTok: 5, outputPerMTok: 30, contextWindow: 272_000 },
  { key: 'openai::gpt-5.4-pro', id: 'gpt-5.4-pro', provider: 'openai',
    label: 'GPT-5.4 Pro', tags: ['reasoning'],
    inputPerMTok: 30, outputPerMTok: 180 },
  { key: 'openai::gpt-5.4', id: 'gpt-5.4', provider: 'openai',
    label: 'GPT-5.4', tags: ['legacy'],
    inputPerMTok: 2.5, outputPerMTok: 15 },
  { key: 'openai::gpt-5.4-mini', id: 'gpt-5.4-mini', provider: 'openai',
    label: 'GPT-5.4 mini', tags: ['fast'],
    inputPerMTok: 0.75, outputPerMTok: 4.5 },
  { key: 'openai::gpt-5.4-nano', id: 'gpt-5.4-nano', provider: 'openai',
    label: 'GPT-5.4 nano', tags: ['cheap', 'fast'],
    inputPerMTok: 0.2, outputPerMTok: 1.25 },
  { key: 'openai::o4-mini', id: 'o4-mini', provider: 'openai',
    label: 'o4-mini', tags: ['reasoning', 'cheap'],
    inputPerMTok: 1.1, outputPerMTok: 4.4 },
];

/** Google Gemini — served through Genkit. */
export const GOOGLE_MODELS: CatalogModel[] = [
  { key: 'google::gemini-3-flash-preview', id: 'gemini-3-flash-preview', provider: 'google',
    label: 'Gemini 3 Flash (preview)', tags: ['fast'] },
  { key: 'google::gemini-2.5-flash', id: 'gemini-2.5-flash', provider: 'google',
    label: 'Gemini 2.5 Flash', tags: ['balanced', 'fast'] },
  { key: 'google::gemini-2.5-flash-lite', id: 'gemini-2.5-flash-lite', provider: 'google',
    label: 'Gemini 2.5 Flash Lite', tags: ['cheap', 'fast'] },
];

/**
 * Azure AI Foundry — the deployment already configured for this app. Kept as a
 * separate provider from first-party OpenAI on purpose: an Azure deployment
 * named `gpt-5.4` and OpenAI's `gpt-5.4` are different endpoints with separate
 * billing, so both can be offered at once without one shadowing the other.
 */
export const AZURE_MODELS: CatalogModel[] = [
  { key: `azure::${AZURE_DEPLOYMENT}`, id: AZURE_DEPLOYMENT, provider: 'azure',
    label: `${AZURE_DEPLOYMENT} (Azure)`, tags: [],
    notes: 'Your Azure deployment — billed to Azure credits.' },
];

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  google: 'Google Gemini',
  azure: 'Azure AI Foundry',
};

export const TAG_LABELS: Record<ModelTag, string> = {
  flagship: 'top', balanced: 'balanced', cheap: 'cheap',
  fast: 'fast', reasoning: 'reasoning', legacy: 'older',
};

const ALL_MODELS: Record<AIProvider, CatalogModel[]> = {
  anthropic: ANTHROPIC_MODELS,
  openai: OPENAI_MODELS,
  google: GOOGLE_MODELS,
  azure: AZURE_MODELS,
};

/** Direct providers first — they're the ones you pick deliberately. */
export const PROVIDER_ORDER: AIProvider[] = ['anthropic', 'openai', 'google', 'azure'];

/**
 * Providers enabled for this deployment. Defaults to Google + Azure, which is
 * what Notora shipped with before OpenAI and Anthropic were added, so an
 * existing install keeps working with no env changes.
 */
export function enabledProviders(): AIProvider[] {
  const raw = process.env.NEXT_PUBLIC_AI_PROVIDERS;
  if (!raw || !raw.trim()) return ['google', 'azure'];
  const wanted = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return PROVIDER_ORDER.filter(p => wanted.includes(p));
}

/** Every model on offer, in picker order. */
export function availableModels(): CatalogModel[] {
  return enabledProviders().flatMap(p => ALL_MODELS[p]);
}

/**
 * Resolve a stored selection to a catalog entry.
 *
 * Accepts a provider-qualified key (`"openai::gpt-5.6-sol"`) or a bare id
 * (`"gemini-2.5-flash"`). The bare-id path keeps selections that were
 * persisted before keys existed working. On an ambiguous bare id we prefer
 * Azure, since that deployment is explicitly configured for this app while the
 * direct catalogs are defaults.
 */
export function resolveModel(idOrKey: string | undefined | null): CatalogModel | undefined {
  if (!idOrKey) return undefined;
  const models = availableModels();
  const exact = models.find(m => m.key === idOrKey);
  if (exact) return exact;
  const matches = models.filter(m => m.id === idOrKey);
  if (matches.length <= 1) return matches[0];
  return matches.find(m => m.provider === 'azure') ?? matches[0];
}

/** The key the app should start on when nothing is stored. */
export function defaultModelKey(): string {
  const models = availableModels();
  // Prefer a balanced-tagged model, else the first on offer.
  return (models.find(m => m.tags.includes('balanced')) ?? models[0])?.key ?? 'google::gemini-2.5-flash';
}
