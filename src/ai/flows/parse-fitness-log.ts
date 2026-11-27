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
  /** The user's local time (HH:mm), to file meals under breakfast/lunch/… when the message doesn't say. */
  localTime?: string;
  /** Meals already logged that day, numbered: the message may ask to change them ("lunch was 2 bowls", "all had ghee"). */
  loggedMeals?: (Omit<FitnessDraft['meals'][number], never> & { index: number })[];
  /** Pending edits from an earlier turn, when the user is correcting them. */
  currentEdits?: LoggedMealEdit[];
  /** Saved foods, then catalogue foods, that this message mentions (exact nutrition; see lib/food-match). */
  knownFoods?: string[];
};
export type LoggedMealEdit = { index: number; delete?: boolean; name?: string; kcal?: number; proteinG?: number; carbsG?: number; fatG?: number; fiberG?: number; slot?: string };
export type ParseFitnessLogOutput = FitnessDraft & { reply: string; web?: 'tavily' | 'openai'; edits: LoggedMealEdit[] };

const OutputSchema = z.object({
  date: z.string().describe('YYYY-MM-DD the entries belong to'),
  meals: z.array(z.object({
    name: z.string().describe('Food item or meal, with portion, e.g. "2 rotis"'),
    kcal: z.number().int().describe('Estimated calories'),
    proteinG: z.number().describe('Estimated protein in grams'),
    carbsG: z.number().optional().describe('Estimated carbohydrates in grams'),
    fatG: z.number().optional().describe('Estimated fat in grams'),
    fiberG: z.number().optional().describe('Estimated dietary fibre in grams'),
    slot: z.string().optional().describe('One of: breakfast, morningSnack, lunch, eveningSnack, dinner'),
    grams: z.number().optional().describe('Weight of this portion in grams (ml for drinks) when stated or confidently known; omit if unsure'),
  })).default([]),
  activities: z.array(z.object({
    name: z.string(),
    minutes: z.number(),
    kcal: z.number().int().describe('Active calories burned (not including resting burn)'),
    stepBased: z.boolean().describe('true for walking, running, jogging, hiking'),
  })).default([]),
  edits: z.array(z.object({
    index: z.number().int().describe('index of the already-logged meal being changed'),
    delete: z.boolean().optional().describe('true to remove that logged meal'),
    name: z.string().optional(), kcal: z.number().optional(), proteinG: z.number().optional(), carbsG: z.number().optional(),
    fatG: z.number().optional(), fiberG: z.number().optional(), slot: z.string().optional(),
  })).default([]).describe('Changes to meals already logged that day; only the fields that change'),
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
{{#if loggedText}}
Meals ALREADY LOGGED for {{{dayYmd}}} (index: name | kcal | protein g | carbs g | fat g | fibre g | meal):
{{{loggedText}}}
{{/if}}
{{#if draftJson}}
The user is correcting this earlier draft. Return the FULL revised draft (keep everything they didn't change):
{{{draftJson}}}
{{/if}}
{{#if foodsText}}
KNOWN FOODS with exact nutrition, nearest match first for each item the user named: the user's saved foods, then the app's catalogue (values from product labels and Indian food tables). For each item, use the known food that is the same food (brand, variant, size and cooked/raw state match what the user said), scaled to the amount eaten, instead of estimating or using web results; the user's saved foods win over catalogue ones. If several fit equally, use the first. If none is the same food (e.g. only a different dal or flavour is listed), ignore them for that item and use web results if given, else your own knowledge:
{{{foodsText}}}
{{/if}}
{{#if webFacts}}
Web search results for this message (use them for branded, packaged or restaurant items; ignore anything unrelated):
{{{webFacts}}}
{{/if}}

Rules:
1. Food and drinks go in "meals", one entry per item or dish, with realistic kcal, protein, carbs, fat and fibre for the stated or visible portion. Be specific (plain roti vs butter naan). Keep them consistent: protein×4 + carbs×4 + fat×9 should be close to kcal.
2. Exercise goes in "activities" with minutes and ACTIVE kcal estimated for the user's weight (exclude resting burn). Walking, running, jogging and hiking have "stepBased": true; everything else false.
3. From a workout screenshot use the active calories. If only total calories are shown, active ≈ total − {{{bmrText}}} × minutes / 1440.
4. A bare number for one of the trackers (e.g. "94.1 kg", "110g protein", "12k steps", "ate 2100 calories", "burned 2600") goes in "values" with that tracker's id. Descriptions of food are never "values".
5. "date" is {{{dayYmd}}} unless the message names another day ("yesterday" is relative to {{{todayYmd}}}).
6. Do not invent anything the user didn't mention or show. Empty lists are fine.
6b. ACCURACY, NEVER UNDER-COUNT: this is a weight-loss log, so a low estimate does real harm. Count what is usually hidden: cooking oil or ghee in Indian dishes (sabzi, dal tadka, curries, parathas: about 1 tsp ≈ 40 kcal per serving, restaurant food about double), ghee or butter on rotis, sugar and milk in chai or coffee, chutneys, raita, papad, pickles and sides. If the portion isn't given, assume a full typical Indian serving (a katori is about 150 g, a restaurant plate is larger). Restaurant, takeaway and street food: add about 30% over the home-cooked version. When unsure between two estimates, use the higher one. Never give a meal fewer kcal than protein×4 + carbs×4 + fat×9.
7. "reply": one short friendly line, e.g. "2 rotis and dal (~450 kcal) plus a 30 min jog (~320 kcal)."
8. Where each item's numbers come from, in order: (a) a matching KNOWN FOOD: use its numbers exactly, only scaled to the amount (don't add rule 6b's padding to it; home-cooked known dishes already include their oil); a serving named like "scoop (40 g)" or "1 phulka" is that amount; (b) web search results that match the item: use their numbers for the stated quantity and mention it in "reply" (e.g. "per Yoga Bar's label"); (c) otherwise estimate from your own knowledge, following rule 6b.
9. No links, URLs or citation marks anywhere in the JSON.
11. EDITING LOGGED MEALS: if the message refers to meals already logged (by name, by meal like "lunch" or "breakfast", or "all"/"everything"/"today's food"), put the changes in "edits" with that meal's index and ONLY the fields that change (for a new portion, scale kcal and every macro; for "cooked in ghee/oil", raise kcal and fat; to remove one, set "delete": true). Never add a logged meal again under "meals". Leave meals the message doesn't mention out of "edits". The accuracy rules above apply to edits too.
10. Every meal gets a "slot": breakfast, morningSnack, lunch, eveningSnack or dinner. Use what the message says ("for breakfast", "evening chai", "after dinner"); otherwise, if the day being logged is today, use the time now ({{{localTime}}}: before 10:30 breakfast, 10:30–12:30 morningSnack, 12:30–15:30 lunch, 15:30–18:30 eveningSnack, later dinner); otherwise pick the most likely meal for that food.`;

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
      draftJson: input.currentDraft || input.currentEdits?.length ? JSON.stringify({ ...input.currentDraft, edits: input.currentEdits ?? [] }) : '',
      loggedText: (input.loggedMeals ?? []).map(m => `${m.index}: ${m.name} | ${Math.round(m.kcal)} | ${m.proteinG ?? 0} | ${m.carbsG ?? 0} | ${m.fatG ?? 0} | ${m.fiberG ?? 0} | ${m.slot ?? 'other'}`).join('\n'),
      webFacts: web?.text ?? '',
      foodsText: (input.knownFoods ?? []).slice(0, 20).join('\n'),
      localTime: input.localTime ?? 'unknown',
    },
    OutputSchema,
    'parseFitnessLogPrompt',
  );
  const known = new Set(input.trackers.map(t => t.id));
  // Never trust the model's date or numbers as-is: a far-future or impossible date would be saved.
  // The slot is a free string from the model; sanitizeDraft keeps it only if it's one of the five.
  const safe = sanitizeDraft({ ...result, meals: result.meals as FitnessDraft['meals'], values: result.values.filter(v => known.has(v.trackerId)) }, input.todayYmd, input.dayYmd);
  // Edits must point at a real logged meal; numbers are clamped like new entries.
  const n = (v?: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
  const indexes = new Set((input.loggedMeals ?? []).map(m => m.index));
  const edits: LoggedMealEdit[] = (result.edits ?? []).filter(e => indexes.has(e.index)).map(e => ({
    index: e.index, ...(e.delete ? { delete: true } : {}), ...(e.name?.trim() ? { name: e.name.trim() } : {}),
    ...Object.fromEntries((['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const).flatMap(k => (n(e[k]) == null ? [] : [[k, n(e[k])]]))),
    ...(e.slot && ['breakfast', 'morningSnack', 'lunch', 'eveningSnack', 'dinner'].includes(e.slot) ? { slot: e.slot } : {}),
  }));
  return { ...safe, reply: result.reply, web: web?.via, edits };
}
