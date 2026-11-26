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
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ai } from '@/ai/genkit';
import { resolveModel, type AIProvider } from '@/lib/model-catalog';
import { requireUser } from '@/lib/session';
import { tracked, usageFrom } from '@/lib/usage';

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
/**
 * The exact keys come from the flow's output schema: without them the model
 * guesses field names from the prompt wording (e.g. "polished" instead of
 * "polishedContent") and the response fails validation.
 */
function jsonOnlySuffix(outputSchema: ZodSchema): string {
  const schema = JSON.stringify(zodToJsonSchema(outputSchema, { $refStrategy: 'none' }));
  return '\n\nRespond with a single valid JSON object matching this JSON Schema, using exactly these keys, and nothing else. ' +
    `Do not wrap it in markdown code fences and do not add commentary.\n${schema}`;
}

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
  // Every AI flow is a public server action that routes through here; without
  // this, anyone could spend this app's AI credits.
  await requireUser();
  const model = resolveModel(modelIdOrKey);
  const provider: AIProvider = model?.provider ?? inferProvider(modelIdOrKey);
  const apiModel = model?.id ?? stripProviderPrefix(modelIdOrKey);

  // Every call is recorded in ai_usage (tokens, estimated cost, latency) for the Usage page.
  const meta = { modelKey: `${provider}::${apiModel}`, operation: 'structured' as const, feature: featureOf(promptName) };
  switch (provider) {
    case 'anthropic':
      return callAnthropic(apiModel, promptTemplate, input, outputSchema, meta);
    case 'openai':
      return callOpenAICompatible(getOpenAIClient(), apiModel, promptTemplate, input, outputSchema, meta);
    case 'azure':
      return callOpenAICompatible(getAzureClient(), apiModel, promptTemplate, input, outputSchema, meta);
    case 'google':
    default:
      return callGemini(apiModel, promptTemplate, input, outputSchema, promptName, inputSchema, meta);
  }
}

type UsageMeta = { modelKey: string; operation: 'structured'; feature: string };

/** "polishStickyNotePrompt" → "polish-sticky-note": the feature name on the Usage page. */
function featureOf(promptName: string): string {
  return promptName.replace(/Prompt$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
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
  outputSchema: T,
  meta: UsageMeta
): Promise<z.infer<T>> {
  const textPrompt = simpleTemplateRender(promptTemplate, input) + jsonOnlySuffix(outputSchema);
  const content: any[] = [{ type: 'text', text: textPrompt }];

  const image = findImage(input);
  if (image) content.push({ type: 'image_url', image_url: { url: image } });

  const response = await tracked(meta, () => retryable(() =>
    client.chat.completions.create({
      model: apiModel,
      messages: [{ role: 'user', content }] as any,
      response_format: { type: 'json_object' },
      stream: false,
    } as any)
  ), (r: any) => usageFrom.openaiChat(r?.usage));

  const raw = (response as any).choices?.[0]?.message?.content;
  if (!raw) throw new Error(`${apiModel} returned an empty response.`);
  return parseModelOutput(outputSchema, JSON.parse(cleanJsonContent(raw)), apiModel);
}

/**
 * Paid fallback for src/lib/web-search.ts: OpenAI's built-in search tool (billed per search)
 * answers in a few plain lines. Tavily's free quota is tried first.
 */
export async function openAIWebSearch(query: string): Promise<string> {
  await requireUser();
  const apiModel = 'gpt-6-luna';
  const response: any = await tracked({ modelKey: `openai::${apiModel}`, operation: 'structured', feature: 'web-search' }, () => retryable(() =>
    getOpenAIClient().responses.create({
      model: apiModel,
      input: `Search the web, then answer in at most 6 short lines of plain facts with numbers. No links. Query: ${query}`,
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
      store: false,
    } as any)
  ), (r: any) => usageFrom.openaiResponses(r?.usage));
  return String(response.output_text ?? '').trim();
}

/**
 * Validate a model response without leaking a raw ZodError to the caller.
 *
 * `outputSchema.parse()` throws a JSON dump of Zod issues. In a Server Action
 * that surfaces to the user as Next.js's opaque "An error occurred in the
 * Server Components render" message, which is impossible to act on. Models
 * legitimately drift on shape now and then, so translate the failure into a
 * short, honest sentence naming the offending fields.
 */
function parseModelOutput<T extends ZodSchema>(outputSchema: T, value: unknown, apiModel: string): z.infer<T> {
  const result = outputSchema.safeParse(value);
  if (result.success) return result.data;
  const fields = result.error.issues.map(i => i.path.join('.') || '(root)').filter(Boolean);
  const unique = [...new Set(fields)].slice(0, 4).join(', ');
  throw new Error(
    `${apiModel} returned an unexpected response shape${unique ? ` (missing/invalid: ${unique})` : ''}. Try again, or pick a different model.`
  );
}

async function callAnthropic<T extends ZodSchema>(
  apiModel: string,
  promptTemplate: string,
  input: Record<string, any>,
  outputSchema: T,
  meta: UsageMeta
): Promise<z.infer<T>> {
  const client = getAnthropicClient();
  const textPrompt = simpleTemplateRender(promptTemplate, input);

  const content: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: textPrompt + jsonOnlySuffix(outputSchema) },
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
  const response = await tracked(meta, () => retryable(() =>
    client.messages.create({
      model: apiModel,
      max_tokens: MAX_TOKENS,
      system: 'You are a precise assistant inside the Notora productivity app. You always reply with a single JSON object matching the requested shape.',
      messages: [{ role: 'user', content }],
    })
  ), r => usageFrom.anthropic(r.usage));

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
  return parseModelOutput(outputSchema, JSON.parse(cleanJsonContent(raw)), apiModel);
}

async function callGemini<T extends ZodSchema>(
  apiModel: string,
  promptTemplate: string,
  input: Record<string, any>,
  outputSchema: T,
  promptName: string,
  inputSchema: ZodSchema | undefined,
  meta: UsageMeta
): Promise<z.infer<T>> {
  const prompt = ai.definePrompt({
    name: promptName,
    input: { schema: (inputSchema ?? z.record(z.any())) as any },
    output: { schema: outputSchema as any },
    prompt: promptTemplate,
  });
  const response = await tracked(meta, () => retryable(() => prompt(input, { model: `googleai/${apiModel}` })), (r: any) => usageFrom.gemini(r?.usage));
  if (!response.output) throw new Error(`Gemini (${apiModel}) returned no structured output.`);
  return response.output as z.infer<T>;
}

// ---------------------------------------------------------------------------
// Tool calling, used by the ADK agent in src/ai/adk (adapted from FinWise's
// ai-client.ts). Gemini isn't here: ADK's own Gemini class handles it.
// ---------------------------------------------------------------------------
export type ToolCall = { id: string; name: string; args: Record<string, unknown> };
export type ToolChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content?: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };
export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };
type ToolChatConfig = { maxOutputTokens?: number; onText?: (delta: string) => void; feature?: string };

export async function callToolChatLLM(
  modelKey: string,
  messages: ToolChatMessage[],
  tools: ToolSpec[],
  config?: ToolChatConfig
): Promise<{ text: string; toolCalls: ToolCall[] }> {
  await requireUser(); // public server action, like callStructuredLLM
  const model = resolveModel(modelKey);
  const provider: AIProvider = model?.provider ?? inferProvider(modelKey);
  const apiModel = model?.id ?? stripProviderPrefix(modelKey);
  const meta = { modelKey: `${provider}::${apiModel}`, operation: 'tool_chat' as const, feature: config?.feature };
  if (provider === 'anthropic') return anthropicToolChat(apiModel, messages, tools, config, meta);
  if (provider === 'google') throw new Error('Gemini tool calls go through ADK\u2019s Gemini model, not callToolChatLLM.');
  // Current OpenAI reasoning models only take function tools on the Responses API.
  if (provider === 'openai') return openAIResponsesToolChat(apiModel, messages, tools, config, meta);

  const oaMessages = messages.map(m => {
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    if (m.role === 'assistant') {
      return {
        role: 'assistant',
        content: m.content ?? null,
        ...(m.toolCalls?.length
          ? { tool_calls: m.toolCalls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
          : {}),
      };
    }
    return { role: m.role, content: m.content };
  });
  const response: any = await tracked(meta, () => retryable(() => getAzureClient().chat.completions.create({
    model: apiModel,
    messages: oaMessages as any,
    ...(tools.length ? { tools: tools.map(t => ({ type: 'function' as const, function: t })) } : {}),
    max_completion_tokens: config?.maxOutputTokens ?? MAX_TOKENS,
  } as any)), (r: any) => usageFrom.openaiChat(r?.usage));
  const msg = response.choices?.[0]?.message ?? {};
  const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((c: any) => ({ id: c.id, name: c.function?.name, args: safeJson(c.function?.arguments) }));
  return { text: msg.content ?? '', toolCalls };
}

type ToolMeta = { modelKey: string; operation: 'tool_chat'; feature?: string };

async function openAIResponsesToolChat(
  apiModel: string,
  messages: ToolChatMessage[],
  tools: ToolSpec[],
  config: ToolChatConfig | undefined,
  meta: ToolMeta
): Promise<{ text: string; toolCalls: ToolCall[] }> {
  const client = getOpenAIClient();
  const instructions = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const input: any[] = [];
  for (const m of messages) {
    if (m.role === 'user') input.push({ role: 'user', content: m.content });
    else if (m.role === 'tool') input.push({ type: 'function_call_output', call_id: m.toolCallId, output: m.content });
    else if (m.role === 'assistant') {
      if (m.content) input.push({ role: 'assistant', content: m.content });
      for (const c of m.toolCalls ?? []) input.push({ type: 'function_call', call_id: c.id, name: c.name, arguments: JSON.stringify(c.args) });
    }
  }
  // No temperature: the reasoning models reject it, and the tool loop doesn't need it.
  const body: any = {
    model: apiModel,
    ...(instructions ? { instructions } : {}),
    input,
    ...(tools.length ? { tools: tools.map(t => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters, strict: false })) } : {}),
    max_output_tokens: config?.maxOutputTokens ?? MAX_TOKENS,
    store: false,
  };
  const onText = config?.onText;
  const response: any = await tracked(meta, () => retryable(() => {
    if (!onText) return client.responses.create(body);
    const stream = client.responses.stream(body);
    stream.on('response.output_text.delta', (e: any) => onText(e.delta));
    return stream.finalResponse();
  }), (r: any) => usageFrom.openaiResponses(r?.usage));
  const output: any[] = response.output ?? [];
  const toolCalls: ToolCall[] = output
    .filter(o => o.type === 'function_call')
    .map(o => ({ id: o.call_id, name: o.name, args: safeJson(o.arguments) }));
  const text = response.output_text
    ?? output.filter(o => o.type === 'message').flatMap(o => o.content ?? []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text).join('');
  return { text, toolCalls };
}

function safeJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function anthropicToolChat(
  apiModel: string,
  messages: ToolChatMessage[],
  tools: ToolSpec[],
  config: ToolChatConfig | undefined,
  meta: ToolMeta
): Promise<{ text: string; toolCalls: ToolCall[] }> {
  const client = getAnthropicClient();
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');

  // Anthropic wants tool results as user turns, and no two turns from the same side in a row.
  const turns: Array<{ role: 'user' | 'assistant'; content: any[] }> = [];
  const push = (role: 'user' | 'assistant', block: any) => {
    const last = turns[turns.length - 1];
    if (last?.role === role) last.content.push(block);
    else turns.push({ role, content: [block] });
  };
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'user') push('user', { type: 'text', text: m.content });
    else if (m.role === 'tool') push('user', { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content });
    else {
      if (m.content) push('assistant', { type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) push('assistant', { type: 'tool_use', id: c.id, name: c.name, input: c.args });
    }
  }
  if (turns.length === 0 || turns[0].role !== 'user') turns.unshift({ role: 'user', content: [{ type: 'text', text: 'Please continue.' }] });

  const params = {
    model: apiModel,
    max_tokens: config?.maxOutputTokens ?? MAX_TOKENS,
    ...(system ? { system } : {}),
    messages: turns as any,
    ...(tools.length ? { tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters as any })) } : {}),
  };
  const onText = config?.onText;
  const response = await tracked(meta, () => retryable(() => {
    if (!onText) return client.messages.create(params);
    const stream = client.messages.stream(params);
    stream.on('text', onText);
    return stream.finalMessage();
  }), r => usageFrom.anthropic(r.usage));

  const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('');
  const toolCalls = response.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    .map(b => ({ id: b.id, name: b.name, args: (b.input ?? {}) as Record<string, unknown> }));
  return { text, toolCalls };
}
