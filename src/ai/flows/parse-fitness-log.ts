'use server';
/**
 * "Log it" on the Logs page: one message (text and/or a photo) → a draft of
 * meals, workouts and tracker values. Nothing is saved here; the page shows
 * the draft as editable cards and saves on the user's confirm.
 */
import { z } from 'genkit';
import { callStructuredLLM } from '@/lib/ai-client';
import type { ModelId } from '@/lib/types';
import { sanitizeDraft, type FitnessDraft } from '@/lib/fitness';
import { searchWeb } from '@/lib/web-search';

export type ParseFitnessLogInput = {
  message: string;
  image?: string;
  todayYmd: string;
  dayYmd: string;
  trackers: { id: string; name: string; unit: string }[];
  weightKg?: number;
  /** Resting burn per day from the profile, for workout-screenshot totals. */
  bmrKcal?: number;
  currentDraft?: FitnessDraft;
  /** The header's web search switch: when on, every message is looked up on the web first. */
  webSearch?: boolean;
};
export type ParseFitnessLogOutput = FitnessDraft & { reply: string; web?: 'tavily' | 'openai' };

const OutputSchema = z.object({
  date: z.string().describe('YYYY-MM-DD the entries belong to'),
  meals: z.array(z.object({
    name: z.string().describe('Food item or meal, with portion, e.g. "2 rotis"'),
    kcal: z.number().int().describe('Estimated calories'),
    proteinG: z.number().describe('Estimated protein in grams'),
  })).default([]),
  activities: z.array(z.object({
    name: z.string(),
    minutes: z.number(),
    kcal: z.number().int().describe('Active calories burned (not including resting burn)'),
    stepBased: z.boolean().describe('true for walking, running, jogging, hiking'),
  })).default([]),
  values: z.array(z.object({
    trackerId: z.string().describe('id from the tracker list'),
    value: z.number(),
  })).default([]),
  reply: z.string().describe('One short, friendly line summarising what was understood'),
});

const PROMPT = `You log food and exercise for a fitness tracker. The user is in India; you are an expert on Indian cuisine and portion sizes.

Today is {{{todayYmd}}}. The day being logged is {{{dayYmd}}}.
The user weighs about {{{weightText}}}.

The user's trackers (id: name, unit):
{{{trackersText}}}

The user's message: "{{{message}}}"
{{#if image}}A photo is attached. It is either food (identify each item and estimate it) or a workout/fitness summary screenshot (read the activity, duration and calories).{{/if}}
{{#if draftJson}}
The user is correcting this earlier draft. Return the FULL revised draft (keep everything they didn't change):
{{{draftJson}}}
{{/if}}
{{#if webFacts}}
Web search results for this message (use them for branded, packaged or restaurant items; ignore anything unrelated):
{{{webFacts}}}
{{/if}}

Rules:
1. Food and drinks go in "meals", one entry per item or dish, with realistic kcal and protein for the stated or visible portion. Be specific (plain roti vs butter naan).
2. Exercise goes in "activities" with minutes and ACTIVE kcal estimated for the user's weight (exclude resting burn). Walking, running, jogging and hiking have "stepBased": true; everything else false.
3. From a workout screenshot use the active calories. If only total calories are shown, active ≈ total − {{{bmrText}}} × minutes / 1440.
4. A bare number for one of the trackers (e.g. "94.1 kg", "110g protein", "12k steps", "ate 2100 calories", "burned 2600") goes in "values" with that tracker's id. Descriptions of food are never "values".
5. "date" is {{{dayYmd}}} unless the message names another day ("yesterday" is relative to {{{todayYmd}}}).
6. Do not invent anything the user didn't mention or show. Empty lists are fine.
7. "reply": one short friendly line, e.g. "2 rotis and dal (~450 kcal) plus a 30 min jog (~320 kcal)."
8. If web search results are given and match an item, use their numbers for the stated quantity and mention it in "reply" (e.g. "per Yoga Bar's label"). Otherwise estimate as usual.
9. No links, URLs or citation marks anywhere in the JSON.`;

export async function parseFitnessLog(input: ParseFitnessLogInput, modelId: ModelId): Promise<ParseFitnessLogOutput> {
  const said = input.message?.trim();
  const web = input.webSearch && said ? await searchWeb(`Nutrition facts (calories, protein) or calories burned for: ${said}`) : null;
  const result = await callStructuredLLM(
    modelId,
    PROMPT,
    {
      message: input.message?.trim() || (input.image ? '(see photo)' : ''),
      image: input.image,
      todayYmd: input.todayYmd,
      dayYmd: input.dayYmd,
      bmrText: String(Math.round(input.bmrKcal ?? 1700)),
      weightText: input.weightKg ? `${Math.round(input.weightKg)} kg` : '75 kg (assumed)',
      trackersText: input.trackers.map(t => `${t.id}: ${t.name} (${t.unit})`).join('\n') || '(none)',
      draftJson: input.currentDraft ? JSON.stringify(input.currentDraft) : '',
      webFacts: web?.text ?? '',
    },
    OutputSchema,
    'parseFitnessLogPrompt',
  );
  const known = new Set(input.trackers.map(t => t.id));
  // Never trust the model's date or numbers as-is: a far-future or impossible date would be saved.
  const safe = sanitizeDraft({ ...result, values: result.values.filter(v => known.has(v.trackerId)) }, input.todayYmd, input.dayYmd);
  return { ...safe, reply: result.reply, web: web?.via };
}
