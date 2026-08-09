'use server';
/**
 * @fileOverview Parses one line of natural language into values for MANY log
 * trackers at once.
 *
 * The logs page previously accepted a single tracker per submission, so a
 * normal day ("weight, steps, protein, calories in, calories out") meant
 * re-selecting the tracker and re-submitting the form five times. This flow
 * turns "94.2kg, 12k steps, 2100 cal, 107g protein" into one batch.
 *
 * - parseLogEntry - Maps free text onto the user's existing trackers.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ModelId } from '@/lib/types';
import { callStructuredLLM } from '@/lib/ai-client';

const TrackerRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
});

const ParseLogEntryInputSchema = z.object({
  naturalLanguageText: z.string().describe('The free-text description of the day, e.g. "94.2kg, 12k steps, 2100 cal".'),
  trackers: z.array(TrackerRefSchema).describe('The trackers that already exist for this user. Only these may be matched.'),
  todayYmd: z.string().describe("Today's date as YYYY-MM-DD, in the user's own timezone."),
});
export type ParseLogEntryInput = z.infer<typeof ParseLogEntryInputSchema>;

const ParsedLogValueSchema = z.object({
  trackerId: z.string().describe('The id of the matched tracker. MUST be one of the provided tracker ids.'),
  value: z.number().describe('The numeric value, already converted into the tracker\'s unit.'),
  notes: z.string().nullish().describe('Any qualitative detail that belonged with this specific value.'),
});

const ParseLogEntryOutputSchema = z.object({
  date: z.string().describe('The YYYY-MM-DD the entry refers to. Use todayYmd unless the text clearly says otherwise ("yesterday", "on Monday").'),
  entries: z.array(ParsedLogValueSchema).describe('One item per tracker the text provided a value for. Omit trackers that were not mentioned.'),
  unmatched: z.array(z.string()).describe('Fragments that looked like measurements but matched no existing tracker, so the user can be told.'),
});
export type ParseLogEntryOutput = z.infer<typeof ParseLogEntryOutputSchema> & { modelId?: ModelId };

export async function parseLogEntry(input: ParseLogEntryInput, modelId: ModelId): Promise<ParseLogEntryOutput> {
  const result = await parseLogEntryFlow(input, { context: { modelId } });
  return { ...result, modelId };
}

const promptTemplate = `You convert a person's shorthand daily log into structured values for their EXISTING trackers.

Today's date (already in the user's timezone) is {{{todayYmd}}}.

Their trackers — you may ONLY emit trackerIds from this list:
{{#each trackers}}
- id: {{{this.id}}} | name: {{{this.name}}} | unit: {{{this.unit}}}
{{/each}}

Text to parse:
---
{{{naturalLanguageText}}}
---

Rules:
1. Match loosely but sensibly on meaning, not exact wording: "wt"/"weighed"/"weight" -> a Weight tracker; "walked 12k"/"12,000 steps" -> a Steps tracker; "burned 2500" -> a Calories Burned tracker; "ate 2100"/"intake" -> a Calorie Intake tracker; "107g protein" -> a Protein tracker.
2. Convert into the tracker's stated unit and return a plain number. Expand shorthand: "12k" -> 12000, "1.5k" -> 1500. Strip unit suffixes from the number itself.
3. If two trackers could plausibly match one fragment, choose the closer name match; never emit the same trackerId twice.
4. Only include a tracker if the text genuinely provides a value for it. Never invent or guess a value.
5. If a measurement clearly has no matching tracker, put the raw fragment in "unmatched" instead of forcing it onto an unrelated tracker.
6. Resolve relative dates against today ("yesterday" -> the day before {{{todayYmd}}}). Default to {{{todayYmd}}}.
7. Put qualitative asides on the tracker they describe ("felt sluggish" with the weight entry), not in every entry.
`;

const parseLogEntryFlow = ai.defineFlow(
  {
    name: 'parseLogEntryFlow',
    inputSchema: ParseLogEntryInputSchema,
    outputSchema: ParseLogEntryOutputSchema,
  },
  async (input, { context }) => {
    const modelId = context?.modelId || 'gemini-1.5-flash-latest';

    const output = await callStructuredLLM(
      modelId,
      promptTemplate,
      input,
      ParseLogEntryOutputSchema,
      'parseLogEntryPrompt',
      ParseLogEntryInputSchema,
    );

    if (!output) {
      throw new Error('Flow failed to produce a valid output.');
    }

    // Never trust the model with foreign keys: drop anything that isn't a real
    // tracker id, and collapse duplicates (last one wins).
    const validIds = new Set(input.trackers.map(t => t.id));
    const byTracker = new Map<string, z.infer<typeof ParsedLogValueSchema>>();
    for (const entry of output.entries) {
      if (!validIds.has(entry.trackerId)) continue;
      if (!Number.isFinite(entry.value)) continue;
      byTracker.set(entry.trackerId, entry);
    }

    return {
      ...output,
      date: /^\d{4}-\d{2}-\d{2}$/.test(output.date) ? output.date : input.todayYmd,
      entries: [...byTracker.values()],
    };
  }
);
