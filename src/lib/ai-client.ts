'use server';

/**
 * Unified AI client for every Notora flow.
 *
 * Routes a selected model to the right provider — Anthropic, first-party
 * OpenAI, Google Gemini (via Genkit), or the Azure deployment — so individual
 * flows don't each need their own provider `if/else`.
 *
 * Adding a model is a catalog edit (`@/lib/model-catalog`), not a change here.
 */

import { AzureOpenAI, OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { z, ZodSchema } from 'zod';
import { ai } from '@/ai/genkit';
import { resolveModel, type AIProvider } from '@/lib/model-catalog';

// ---------------------------------------------------------------------------
// Clients — created lazily so a missing key only breaks the provider that
// needs it, rather than the whole module at import time.
// ---------------------------------------------------------------------------
let openAIClient: OpenAI | undefined;
let anthropicClient: Anthropic | undefined;
let azureClient: AzureOpenAI | undefined;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to .env to use OpenAI models.');
  }
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      organization: process.env.OPENAI_ORG_ID || undefined,
      project: process.env.OPENAI_PROJECT_ID || undefined,
    });
  }
  return openAIClient;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env to use Claude models.');
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    });
  }
  return anthropicClient;
}

function getAzureClient(): AzureOpenAI {
  const rawEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!rawEndpoint || !apiKey) {
    throw new Error('AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY are not set.');
  }
  if (!azureClient) {
    azureClient = new AzureOpenAI({
      // The SDK wants only the origin; it appends /openai/deployments/... itself.
      endpoint: new URL(rawEndpoint).origin,
      apiKey,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
    });
  }
  return azureClient;
}

/**
 * Non-streaming ceiling. Sized so adaptive thinking (on by default on current
 * Claude models) has room to reason and still emit a full answer, while
 * staying under the SDK's HTTP timeout — above ~16k you must stream.
 */
const MAX_TOKENS = 16000;

/**
 * Appended for providers where we ask for a raw JSON object rather than a
 * compiled schema. Also load-bearing for OpenAI: `response_format:
 * json_object` is rejected with a 400 unless the word "json" appears in the
 * messages, and not every flow's prompt says it.
 */
const JSON_ONLY_SUFFIX =
  '\n\nRespond with a single valid JSON object and nothing else. ' +
  'Do not wrap it in markdown code fences and do not add commentary.';

// ---------------------------------------------------------------------------
// Handlebars-like template renderer (kept behaviour-identical to the original
// in azure-openai.ts so existing prompt templates render the same way).
// ---------------------------------------------------------------------------
function simpleTemplateRender(template: string, data: Record<string, any>): string {
  let output = template;

  // Media tags are stripped; images are attached to the message separately.
  output = output.replace(/{{media\s+url=([^}]+)}}/g, '');

  output = output.replace(/{{{json\s+([^}]+)}}}/g, (_m, key) =>
    JSON.stringify(data[key.trim()], null, 2)
  );

  // {{#each list}} ... {{/each}} — supports {{{this}}} plus {{this.prop}} and
  // bare {{prop}} for arrays of objects (the chat history templates need it).
  output = output.replace(/{{#each\s+([^}]+)}}([\s\S]*?){{\/each}}/g, (_m, key, content) => {
    const list = data[key.trim()];
    if (!Array.isArray(list)) return '';
    return list
      .map((item: any) => {
        let row = content.replace(/{{{this}}}/g, String(item));
        if (item && typeof item === 'object') {
          row = row.replace(/{{{?this\.(\w+)}}}?/g, (_x: string, p: string) => String(item[p] ?? ''));
          row = row.replace(/{{{?(\w+)}}}?/g, (full: string, p: string) =>
            p in item ? String(item[p] ?? '') : full
          );
        }
        return row;
      })
      .join('');
  });

  const lookup = (key: string) => {
    const keys = key.trim().split('.');
    let current: any = data;
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) current = current[k];
      else return '';
    }
    return String(current);
  };
  output = output.replace(/{{{\s*([\w.]+)\s*}}}/g, (_m, key) => lookup(key));
  output = output.replace(/{{([\w.]+)}}/g, (_m, key) => lookup(key));

  output = output.replace(/{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g, (_m, key, content) =>
    data[key.trim()] ? content : ''
  );

  return output.trim();
}

function cleanJsonContent(content: string): string {
  return content.replace(/```json\n?|\n?```/g, '').trim();
}

/** Retries transient provider overload only; real errors surface immediately. */
async function retryable<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const msg = String(error?.message || '').toLowerCase();
      const status = error?.status ?? error?.cause?.status;
      // 529 is Anthropic's "overloaded"; 503 is the OpenAI/Azure equivalent.
      const transient =
        status === 503 || status === 529 ||
        msg.includes('503') || msg.includes('529') ||
        msg.includes('overloaded') || msg.includes('service unavailable');
      if (!transient || i === retries) throw error;
      await new Promise(r => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastError;
}

/** Pulls `data:image/png;base64,AAAA` apart for Anthropic's image block. */
function parseDataUri(uri: unknown): { mediaType: string; data: string } | null {
  if (typeof uri !== 'string') return null;
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(uri);
  return match ? { mediaType: match[1], data: match[2] } : null;
}

/** Any data-URI image on the input, whatever the flow calls the field. */
function findImage(input: Record<string, any>): string | undefined {
  for (const field of ['foodImage', 'image', 'imageUrl', 'photoDataUri', 'imageDataUri']) {
    if (typeof input?.[field] === 'string' && input[field].startsWith('data:')) return input[field];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render `promptTemplate` with `input`, send it to whichever provider owns
 * `modelIdOrKey`, and parse the reply against `outputSchema`.
 *
 * @param modelIdOrKey Provider-qualified key (`"openai::gpt-5.6-sol"`) or a
 *   bare model id. Unknown values fall back to Google Gemini, matching the
 *   previous behaviour of the per-flow `else` branch.
 * @param promptName Used as the Genkit prompt name on the Google path; must be
 *   stable per flow so Genkit's registry stays coherent.
 */
export async function callStructuredLLM<T extends ZodSchema>(
  modelIdOrKey: string,
  promptTemplate: string,
  input: Record<string, any>,
  outputSchema: T,
  promptName: string,
  inputSchema?: ZodSchema
): Promise<z.infer<T>> {
  const model = resolveModel(modelIdOrKey);
  const provider: AIProvider = model?.provider ?? inferProvider(modelIdOrKey);
  const apiModel = model?.id ?? stripProviderPrefix(modelIdOrKey);

  switch (provider) {
    case 'anthropic':
      return callAnthropic(apiModel, promptTemplate, input, outputSchema);
    case 'openai':
      return callOpenAICompatible(getOpenAIClient(), apiModel, promptTemplate, input, outputSchema);
    case 'azure':
      return callOpenAICompatible(getAzureClient(), apiModel, promptTemplate, input, outputSchema);
    case 'google':
    default:
      return callGemini(apiModel, promptTemplate, input, outputSchema, promptName, inputSchema);
  }
}

function stripProviderPrefix(idOrKey: string): string {
  const idx = idOrKey.indexOf('::');
  return idx === -1 ? idOrKey : idOrKey.slice(idx + 2);
}

/** Only used for models absent from the catalog (e.g. a stale stored value). */
function inferProvider(idOrKey: string): AIProvider {
  const [maybe] = idOrKey.split('::');
  if (maybe !== idOrKey && ['google', 'openai', 'anthropic', 'azure'].includes(maybe)) {
    return maybe as AIProvider;
  }
  if (idOrKey.startsWith('claude-')) return 'anthropic';
  if (idOrKey.startsWith('gemini-')) return 'google';
  if (idOrKey.startsWith('gpt-') || idOrKey.startsWith('o1') || idOrKey.startsWith('o3') || idOrKey.startsWith('o4')) {
    // Ambiguous between Azure and OpenAI; prefer Azure since that deployment is
    // the one explicitly configured for this app.
    return process.env.AZURE_OPENAI_API_KEY ? 'azure' : 'openai';
  }
  return 'google';
}

/** Shared by first-party OpenAI and Azure OpenAI — same wire protocol. */
async function callOpenAICompatible<T extends ZodSchema>(
  client: OpenAI | AzureOpenAI,
  apiModel: string,
  promptTemplate: string,
  input: Record<string, any>,
  outputSchema: T
): Promise<z.infer<T>> {
  const textPrompt = simpleTemplateRender(promptTemplate, input) + JSON_ONLY_SUFFIX;
  const content: any[] = [{ type: 'text', text: textPrompt }];

  const image = findImage(input);
  if (image) content.push({ type: 'image_url', image_url: { url: image } });

  const response = await retryable(() =>
    client.chat.completions.create({
      model: apiModel,
      messages: [{ role: 'user', content }] as any,
      response_format: { type: 'json_object' },
      stream: false,
    } as any)
  );

  const raw = (response as any).choices?.[0]?.message?.content;
  if (!raw) throw new Error(`${apiModel} returned an empty response.`);
  return outputSchema.parse(JSON.parse(cleanJsonContent(raw)));
}

async function callAnthropic<T extends ZodSchema>(
  apiModel: string,
  promptTemplate: string,
  input: Record<string, any>,
  outputSchema: T
): Promise<z.infer<T>> {
  const client = getAnthropicClient();
  const textPrompt = simpleTemplateRender(promptTemplate, input);

  const content: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: textPrompt + JSON_ONLY_SUFFIX },
  ];

  const image = parseDataUri(findImage(input));
  if (image) {
    // Image first: Claude attends better to a question asked after the image.
    content.unshift({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType as any, data: image.data },
    });
  }

  // No temperature/top_p — current Claude models reject them outright.
  const response = await retryable(() =>
    client.messages.create({
      model: apiModel,
      max_tokens: MAX_TOKENS,
      system: 'You are a precise assistant inside the Notora productivity app. You always reply with a single JSON object matching the requested shape.',
      messages: [{ role: 'user', content }],
    })
  );

  // Safety classifiers can decline with HTTP 200 — check before reading content.
  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude (${apiModel}) declined this request. Try a different model.`);
  }

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  if (!raw) throw new Error(`Claude (${apiModel}) returned an empty response.`);
  return outputSchema.parse(JSON.parse(cleanJsonContent(raw)));
}

async function callGemini<T extends ZodSchema>(
  apiModel: string,
  promptTemplate: string,
  input: Record<string, any>,
  outputSchema: T,
  promptName: string,
  inputSchema?: ZodSchema
): Promise<z.infer<T>> {
  const prompt = ai.definePrompt({
    name: promptName,
    input: { schema: (inputSchema ?? z.record(z.any())) as any },
    output: { schema: outputSchema as any },
    prompt: promptTemplate,
  });
  const response = await retryable(() => prompt(input, { model: `googleai/${apiModel}` }));
  if (!response.output) throw new Error(`Gemini (${apiModel}) returned no structured output.`);
  return response.output as z.infer<T>;
}
