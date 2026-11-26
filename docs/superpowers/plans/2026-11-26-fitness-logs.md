# Fitness Logs Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the form-like Logs page with a fitness-tracker page: today's rings, trend weight, weekly charts, an editable day log, tracker tiles, and a chat/voice/photo "Log it" sheet that records intake and burn.

**Architecture:**
- All rules (trend weight, burn, totals, how a draft is saved) live in one pure module, `src/lib/fitness.ts`, checked by assert scripts.
- One new AI flow turns a message (text and/or photo) into a draft.
- UI components live in `src/components/fit/`, with scoped `fit-ui` CSS tokens and the Newsreader serif, modelled on FinWise `src/components/split/`.
- Saves go through the existing versioned `handleDataChange`.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, Tailwind, shadcn/ui (Sheet), recharts 2, framer-motion, date-fns 3, Genkit + `callStructuredLLM`, zod 3.

**Spec:** `docs/superpowers/specs/2026-11-26-fitness-logs-design.md`

## Global Constraints

- Tracker names stay exactly `Weight`, `Protein Intake`, `Steps`, `Daily Calorie Intake`, `Calories Burned`. Fitbit trackers are found by `healthMetric` (`steps`, `sleep`, `restingHr`), with Steps also matched by name.
- Entry ids:
  - derived: `auto-intake-<date>`, `auto-protein-<date>`, `auto-burn-<date>`;
  - Fitbit: `fitbit-<metric>-<date>`;
  - any other id is a stored total and is never rewritten except by the explicit rules in Task 1;
  - a stored value of 0 counts as "no entry".
- Trend weight: EMA, α = 0.1, gaps carried forward. Weekly rate: least squares over the last 28 days of trend. ETA only when moving toward the goal at ≥ 0.05 kg/week.
- BMR: Mifflin-St Jeor (male +5, female −161). Steps burn = steps × 0.0005 × kg. Calorie target suggestion = mean burn of the last 14 days that have a burn value, minus 500, rounded to 50. Protein suggestion = 1.6 × trend kg, rounded to 5. Steps suggestion = 10,000.
- Nothing is saved from the chat before **Save**.
- Every AI call goes through `callStructuredLLM` with the user's selected model (`useModelStore().selectedModel`); photos are downscaled with the same 1280 px / JPEG 0.8 canvas code used in `AICalorieCoach.tsx`.
- Colour is never the only signal; rings and charts have text equivalents; tap targets ≥ 44 px; animations respect `prefers-reduced-motion`.
- Light and dark token sets.

## Review Focus

1. A day that has meals, a typed total, then one meal deleted: totals must equal the remaining items; no orphan entries. *(Task 1 test `deleteMealRecomputes`.)*
2. Logging a walk on a day with Fitbit steps must not raise burn. *(Task 1 test `stepBasedNotCounted`.)*
3. Logging a workout on an old day whose burn is a stored AI total: burn = old total + workout, stored once, and re-saving doesn't add it again. *(Task 1 test `storedBurnBecomesBase` + `idempotentResave`.)*
4. No profile set: page renders, burn and Net show "—", and the rings show "Set targets" instead of crashing on NaN. *(Task 1 test `noProfileBurnNull`; Task 8 browser check.)*
5. Weight series with long gaps (the user stopped logging on 31 Aug): trend chart and rate don't explode; rate is `null` with fewer than 7 weigh-ins in 28 days. *(Task 1 test `rateNeedsData`.)*

---

### Task 1: Fitness rules module

**Files:**
- Modify: `src/lib/types.ts` (add types; extend `AppData`)
- Create: `src/lib/fitness.ts`
- Create: `src/lib/fitness.check.ts` (run with `npx tsx src/lib/fitness.check.ts`, same pattern as `health-merge.check.ts`)

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export interface FitnessProfile { sex: 'male' | 'female'; birthYear: number; heightCm: number }
  export interface Meal { id: string; name: string; kcal: number; proteinG: number }
  export interface Activity { id: string; name: string; minutes: number; kcal: number; stepBased: boolean }
  export interface FitnessDay { meals: Meal[]; activities: Activity[]; burnBase?: number }
  // AppData gains: fitnessProfile?: FitnessProfile; fitnessDays?: Record<string, FitnessDay>;
  ```
- Produces, in `fitness.ts` (all pure, dates `yyyy-MM-dd`):
  ```ts
  export const TRACKER: { weight: 'Weight'; protein: 'Protein Intake'; steps: 'Steps'; intake: 'Daily Calorie Intake'; burned: 'Calories Burned' };
  export type TrackerKey = keyof typeof TRACKER | 'sleep' | 'restingHr';
  export function findTracker(data: AppData, key: TrackerKey): LogTracker | undefined;
  export function valueOn(t: LogTracker | undefined, ymd: string): number | undefined; // undefined for missing or 0
  export type TrendPoint = { date: string; weight?: number; trend: number };
  export function trendSeries(logs: LogEntry[]): TrendPoint[];       // one point per day, first→last weigh-in
  export function weeklyRate(series: TrendPoint[], today: string): number | null;
  export function goalEta(trend: number, rate: number | null, goal: number | undefined, today: string): string | null;
  export function bmr(p: FitnessProfile, kg: number, ymd: string): number;
  export function weightOn(data: AppData, ymd: string): number | undefined; // that day's weigh-in, else latest trend
  export type BurnInfo = { total: number | null; base: number | null; source: 'stored' | 'computed' | 'none';
    activities: { activity: Activity; counted: boolean }[] };
  export function dayBurn(data: AppData, ymd: string): BurnInfo;
  export function dayIntake(data: AppData, ymd: string): { kcal?: number; proteinG?: number };
  export type FitnessDraft = { date: string; meals: Omit<Meal, 'id'>[]; activities: Omit<Activity, 'id'>[];
    values: { trackerId: string; value: number }[] };
  export function describeValueChange(data: AppData, draft: FitnessDraft, v: FitnessDraft['values'][number]): string | null; // "replaces 1,650 kcal", "Fitbit won't update this day", or null
  export function applyDraft(data: AppData, draft: FitnessDraft, newId: () => string): AppData;
  export function editDayItem(data: AppData, ymd: string, kind: 'meal' | 'activity', id: string, patch: Partial<Meal & Activity> | null, newId: () => string): AppData; // null = delete
  export function suggestTargets(data: AppData, today: string): { steps: number; proteinG: number | null; kcal: number | null };
  export function loggingStreak(data: AppData, today: string): number; // ignores fitbit-* entries
  ```

**Rules `applyDraft` / `editDayItem` must implement** (from spec "Data model and rules"):
- Missing trackers among the five are created with units `kg`, `g`, `steps`, `kcal`, `kcal`.
- **Meals**: if the day has no meals yet and a stored intake or protein value exists, first push `{ name: 'Earlier total', kcal: storedIntake ?? 0, proteinG: storedProtein ?? 0 }`. Then append the meals. Then replace that date's intake and protein entries with `auto-intake-<date>` = Σkcal and `auto-protein-<date>` = ΣproteinG.
- **Activities**: append. If the day has no `burnBase` and a stored (non-auto, > 0) burn exists, move it into `burnBase` and remove that entry. Write `auto-burn-<date>` = `dayBurn(...).total` when it is non-null.
- **Values**:
  - intake or protein: the day's meals collapse into one `'Day total'` meal carrying the new value and the other total (or that meal's own sum), then the auto entries are rewritten;
  - burn: set `burnBase` = value, clear that day's activities, write `auto-burn-<date>`;
  - steps: write `{ id: newId(), date, value }` (manual, so the Fitbit merge leaves it);
  - any other tracker: replace that date's entry with a new id.
- `dayBurn`:
  - `counted = !(activity.stepBased && steps value exists that day)`;
  - base = `burnBase` ?? stored non-auto value ?? (profile and weight known ? `bmr + steps × 0.0005 × kg` : null);
  - total = base == null ? null : base + Σ counted kcal;
  - an existing `auto-burn` value is never used as the base.
- After any change, a `fitnessDays[date]` with no meals, no activities and no `burnBase` is deleted.

- [ ] **Step 1: Write `fitness.check.ts` with these asserts (fixtures built inline)**

```ts
// trendSeries: weigh-ins 100 (d1), gap d2, 99 (d3) → 3 points; d2.trend === d1.trend; d3.trend ≈ 100 + 0.1*(99-100)
// rateNeedsData: 5 weigh-ins in 28 days → weeklyRate === null; 28 daily points falling 0.1/day trend → rate ≈ -0.7 (±0.05) only after trend settles (use series built directly)
// goalEta: trend 93, rate -0.5, goal 85 → 16 weeks after today; rate +0.2 with goal below → null; |rate| 0.03 → null
// bmr: male 30y 175cm 75kg → 1698.75 (birthYear = year(ymd) - 30)
// noProfileBurnNull: no profile, no stored burn → dayBurn.total === null, source 'none'
// computedBurn: profile + weight 80 + 10,000 steps → base = bmr + 400
// stepBasedNotCounted: steps exist that day + activity {walk, stepBased:true, kcal 200} → total === base; same with no steps → base + 200
// storedBurnBecomesBase: stored burn 2600 (id 'x1') + applyDraft activity yoga 150 → burnBase 2600, entry 'x1' gone, auto-burn = 2750
// idempotentResave: applyDraft with empty meals/activities/values on that day → auto-burn still 2750
// earlierTotal: stored intake 1200 + protein 60, applyDraft meal {Dal, 300, 15} → meals [Earlier total 1200/60, Dal 300/15], auto-intake 1500, auto-protein 75
// deleteMealRecomputes: editDayItem(delete Dal) → auto-intake 1200, auto-protein 60
// valueReplacesIntake: then values intake 2100 → meals = [Day total 2100 / 75], auto-intake 2100
// stepsValueManual: Fitbit steps entry 'fitbit-steps-<d>' 8000, values steps 12000 → entry for d has non-fitbit id and value 12000; describeValueChange mentions Fitbit
// zeroIsNoEntry: stored burn value 0 → treated as missing (source 'computed' when profile known)
// suggestTargets: 14 days burn 2600 → kcal 2100; trend 93.4 → proteinG 150
// loggingStreak: manual entries today and yesterday + fitbit-only entry the day before → 2
console.log('fitness checks passed');
```

- [ ] **Step 2: Run it; expect failure** — `npx tsx src/lib/fitness.check.ts` → fails to import `./fitness`.
- [ ] **Step 3: Add the types to `types.ts` and implement `fitness.ts` to the interfaces and rules above.**
- [ ] **Step 4: Run it; expect pass** — `npx tsx src/lib/fitness.check.ts` → `fitness checks passed`.
- [ ] **Step 5: Commit** — `git add src/lib/types.ts src/lib/fitness.ts src/lib/fitness.check.ts && git commit -m "feat(logs): fitness rules module with checks"`

### Task 2: "Log it" AI flow

**Files:**
- Create: `src/ai/flows/parse-fitness-log.ts`

**Interfaces:**
- Consumes: `callStructuredLLM` (`src/lib/ai-client.ts`), `FitnessDraft` (Task 1).
- Produces:
  ```ts
  export type ParseFitnessLogInput = { message: string; image?: string; todayYmd: string; dayYmd: string;
    trackers: { id: string; name: string; unit: string }[]; weightKg?: number; currentDraft?: FitnessDraft };
  export type ParseFitnessLogOutput = FitnessDraft & { reply: string };
  export async function parseFitnessLog(input: ParseFitnessLogInput, modelId: ModelId): Promise<ParseFitnessLogOutput>;
  ```
- Output zod schema: `date` string; `meals[{ name, kcal int, proteinG number }]`; `activities[{ name, minutes number, kcal int, stepBased boolean }]`; `values[{ trackerId, value number }]`; `reply` string. Arrays default to `[]`.
- Prompt rules (must all appear):
  - Indian cuisine expertise (from `analyze-food-calories`).
  - Food → `meals`, exercise → `activities`; activity kcal are *active* calories estimated for `weightKg`.
  - Walking, running, jogging and hiking are `stepBased: true`.
  - Workout screenshot: use active kcal; if only total is shown, active ≈ total − BMR×minutes/1440 (assume BMR 1700 if unknown).
  - A bare number for a tracker goes to `values` with that tracker's id. Food descriptions are never `values`.
  - `date` = `dayYmd` unless the message says otherwise ("yesterday" relative to `todayYmd`).
  - If `currentDraft` is given, return the full revised draft (the user is correcting it).
  - `reply` = one short friendly line.
  - The photo uses the same `{{media url=image}}` field name `image` that `findImage` in `ai-client.ts` picks up.
- `image` and `currentDraft` must be optional in the input schema; callers pass `undefined`, never `null`.

- [ ] **Step 1: Write a temporary check** `.smoke/fit-flow.mts`, using the `next/headers` stub harness pattern from the GPT-6 Luna testing (stub cookie + `--tsconfig .smoke/tsconfig.json`). It asserts with model `openai::gpt-6-luna`:
  - "2 rotis, dal and a 30 min jog" → ≥ 1 meal with kcal > 0 and 1 activity with `stepBased === true`;
  - "94.1 kg and 110g protein" with Weight / Protein trackers → `values` with both ids and no meals;
  - meal photo (`.smoke/meal.jpg`, rendered as before) → ≥ 3 meals;
  - "make the jog 45 min" with `currentDraft` from the first case → the activity's minutes are 45 and the meals are kept.
- [ ] **Step 2: Run it; expect failure** — `npx tsx --env-file=.env --tsconfig .smoke/tsconfig.json .smoke/fit-flow.mts` fails to import the flow.
- [ ] **Step 3: Implement `parse-fitness-log.ts`.**
- [ ] **Step 4: Run it; expect 4/4 pass.** Then `rm -rf .smoke`.
- [ ] **Step 5: Commit** — `git add src/ai/flows/parse-fitness-log.ts && git commit -m "feat(logs): parse-fitness-log AI flow"`

### Task 3: Fitness look, rings and hero

**Files:**
- Create: `src/components/fit/fit.css` — tokens adapted from FinWise `split.css`:
  - variables `--f-accent #0f9d99`, `--f-deep #006f73`, `--f-soft #cdeeea`, `--f-tint #ebf8f7`, `--f-coral #e8604f`, `--f-good #15803d`, `--f-bg #f4faf9`, `--f-card #fff`, `--f-line #dbecea`, `--f-ink #0b1f1e`, `--f-sec #4f6d6b`, plus the matching `.dark .fit-ui` set from split.css;
  - classes `.fit-ui`, `.fit-display` (serif, italic `em` weight 650), `.f-card`, `.f-hero`, `.f-muted`, `.f-pill`, `.f-icon-btn`, `.f-voice-btn`.
- Create: `src/components/fit/font.ts` — `export const fitSerif = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-fit-serif' })`.
- Create: `src/components/fit/Ring.tsx` — `export function Ring({ value, target, label, unit, over }: { value?: number; target?: number; label: string; unit: string; over?: 'bad' | 'good' }): JSX.Element`. SVG ring, `aria-label` like "Steps 8,200 of 10,000, 82%"; it shows "Set target" when `target` is missing and "—" when `value` is missing; coral when `over === 'bad'` and value > target.
- Create: `src/components/fit/Hero.tsx` — `export function Hero(props: { day: string; onDay: (ymd: string) => void; rings: React.ReactNode; netKcal: number | null; sleepH?: number; rhr?: number; streak: number; fitbit: React.ReactNode; lines: string[]; onType: () => void; onVoice: () => void; onPhoto: () => void }): JSX.Element`. Layout as in the spec sketch. The typed line uses FinWise `hero.tsx`'s `useTyped` and `Accent`, copied. The day control offers Today / Yesterday / a date input (`<input type="date">`). Net is green with "deficit" when < 0 and coral with "surplus" when > 0.
- Create: `src/components/fit/FitbitChip.tsx` — reuses `getHealthStatus` and `syncHealthNow` from `@/lib/health-actions` plus `useApp().reload`. Shows "Fitbit · synced X ago ⟳", "Reconnect" (links to `/api/health/connect`), or nothing when `unavailable` or `disconnected`.

- [ ] **Step 1: Build the components; `npx tsc --noEmit -p .` shows no errors in `src/components/fit/`.**
- [ ] **Step 2: Commit** — `git commit -m "feat(logs): fitness look, rings, hero"` (visual check happens in Task 8).

### Task 4: Weight, week, day log, tracker tiles

**Files:**
- Create: `src/components/fit/WeightCard.tsx` — `({ data, today, onSetGoal }: { data: AppData; today: string; onSetGoal: () => void })`:
  - recharts `ComposedChart` with `Scatter` for weigh-ins, `Line` for trend, and a dashed `ReferenceLine` for the goal;
  - range toggle 30d / 90d / All;
  - header "Trend 93.4 kg · ▼0.5 kg/week · goal 85 kg ≈ 14 Mar" using `trendSeries` / `weeklyRate` / `goalEta`;
  - no goal → "Set a goal" button; no weigh-ins → empty state.
- Create: `src/components/fit/WeekCards.tsx` — `({ data, day }: { data: AppData; day: string })`:
  - over the 7 days ending on `day`: paired bars of intake vs `dayBurn().total`, with net per day in the tooltip;
  - steps bars with the goal line;
  - sleep bars in hours;
  - each chart has a one-line text summary (e.g. "Avg net −380 kcal/day").
- Create: `src/components/fit/DayLog.tsx` — `({ data, day, onEdit }: { data: AppData; day: string; onEdit: (kind: 'meal' | 'activity', id: string, patch: Partial<Meal & Activity> | null) => void })`:
  - lists `fitnessDays[day]` meals (+kcal, protein) and activities (−kcal, or "counted in your steps");
  - tapping a row edits its numbers inline, and an × deletes it;
  - empty → "Nothing logged yet. Tap ✏️, 🎙 or 📷 above."
- Create: `src/components/fit/TrackerTiles.tsx` — `({ data, onOpen, onManage }: { data: AppData; onOpen: (trackerId: string) => void; onManage: () => void })`:
  - grid of tiles with name, latest value + unit, 14-day sparkline (recharts `LineChart` without axes), and ▲▼ versus the previous 7-day average;
  - colour by `trackersWhereDecreaseIsGood` semantics (Weight and intake falling = good);
  - for Calories Burned, the sparkline and latest value use `dayBurn().total`.
- Create: `src/components/fit/TrackerSheet.tsx` — a `Sheet` wrapping the existing `LogTrackerCard` (props unchanged) for the chosen tracker.

- [ ] **Step 1: Build the components; tsc is clean in `src/components/fit/`.**
- [ ] **Step 2: Commit** — `git commit -m "feat(logs): weight trend, week charts, day log, tracker tiles"`

### Task 5: Log-it chat sheet, targets sheet, manage sheet

**Files:**
- Create: `src/components/fit/LogSheet.tsx` — `({ open, onOpenChange, mode, data, day, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; mode: 'type' | 'voice' | 'photo'; data: AppData; day: string; onSave: (draft: FitnessDraft) => void })`:
  - bottom `Sheet` with a message thread, text input, 🎙 button (Web Speech; detection copied from FinWise `voice-sheet.tsx` `SR()`; hidden when unsupported), and 📷 button (`<input type="file" accept="image/*" capture="environment">` plus downscale);
  - `mode` decides what opens on open (focus input / start listening / open file picker);
  - each send calls `parseFitnessLog` with `currentDraft` after the first turn;
  - the draft renders as editable cards (meal, activity, value), each with ×; value cards show `describeValueChange`;
  - **Save** calls `onSave(draft)`, shows "Saved ✓", then resets;
  - errors show inline in the thread ("Couldn't read that, try again"); the draft is kept.
- Create: `src/components/fit/TargetsSheet.tsx` — `({ open, onOpenChange, data, onSave }: {...; onSave: (next: AppData) => void })`:
  - fields for sex, age (stored as `birthYear`), height cm, weight goal, calorie target, protein target, steps target;
  - pre-filled from current goals, else `suggestTargets`;
  - on first render, if `data.fitnessProfile` is missing, it pre-fills from `localStorage['notora-user-stats']` (`{ age, gender, height }`) inside try/catch;
  - saves the profile to `AppData.fitnessProfile` and the goals to the matching trackers' `goal` (creating trackers as Task 1 does).
- Create: `src/components/fit/ManageSheet.tsx` — `({ open, onOpenChange, data, onDataChange })`: the create-tracker form moved from `LogManager.tsx`, a tracker list (rename, unit, goal, delete with confirmation) and `<HealthConnectCard />`.

- [ ] **Step 1: Build the components; tsc is clean in `src/components/fit/`.**
- [ ] **Step 2: Commit** — `git commit -m "feat(logs): log-it chat sheet, targets and manage sheets"`

### Task 6: Assemble the page, remove the old parts, showcase route

**Files:**
- Create: `src/components/fit/FitnessPage.tsx` — `({ data, onDataChange, showcase }: { data: AppData; onDataChange: (d: AppData) => void; showcase?: boolean })`:
  - wraps everything in `<div className={cn('fit-ui', fitSerif.variable)}>`;
  - holds `day` state (default today, in `APP_TIMEZONE`-free local `format(new Date(), 'yyyy-MM-dd')`);
  - layout: Hero → Weight → Week (two columns from `lg`) → DayLog → TrackerTiles;
  - wires the sheets;
  - `onSave = draft => onDataChange(applyDraft(data, draft, uuidv4))`; `onEdit` → `editDayItem`;
  - hero lines are built in code from the day's data, like FinWise `hero-lines`: "Had *2* rotis and dal…" when items exist, otherwise example prompts such as "94.1 kg, *12k* steps, *110g* protein";
  - first run (no profile or no goals): the hero rings show the Set targets state, which opens TargetsSheet.
- Modify: `src/app/logs/page.tsx` — keep the auth redirect and showcase hook; render `<FitnessPage …/>`; drop the old helpers and imports.
- Delete: `src/components/notora/AICalorieCoach.tsx`, `AddNewLogCard.tsx`, `LogStreakDisplay.tsx`, `LogManager.tsx` (verify with `grep -rln` that nothing else imports them).
- Create: `src/app/showcase/logs/page.tsx` — same pattern as `src/app/showcase/tasks/page.tsx`. The Dock already links `/showcase/logs`, which 404s today.
- Modify: `src/contexts/showcase-context.tsx` — replace `logTrackers: []` with 60 days of demo Weight (drifting 95 → 92.5 with noise), Steps, Protein, Daily Calorie Intake, Sleep (`healthMetric: 'sleep'`), Resting heart rate (`healthMetric: 'restingHr'`), a `fitnessProfile` and goals, and `fitnessDays` for today with 2 meals and 1 activity. Values are generated deterministically from the day index (no `Math.random`, to avoid hydration mismatches).

- [ ] **Step 1: Run `grep -rln "AICalorieCoach\|AddNewLogCard\|LogStreakDisplay\|LogManager" src`; expect only the files being deleted and `logs/page.tsx`.**
- [ ] **Step 2: Make the changes. `npx tsc --noEmit -p .` must show the baseline error count or lower (27), with none in changed files.**
- [ ] **Step 3: `npm run build` passes.**
- [ ] **Step 4: Commit** — `git commit -m "feat(logs): new fitness Logs page; showcase logs route"`

### Task 7: End-to-end save check with GPT-6 Luna

- [ ] **Step 1: Using the `.smoke` harness on a throwaway `smoke-test-claude` workspace (deleted afterwards), assert:**
  - `parseFitnessLog("2 rotis and dal, 40 min walk")` → `applyDraft` → `saveAppData` → reload shows `auto-intake` > 0 and the walk listed;
  - with steps present, burn is unchanged by the walk;
  - a stale-version save is still refused.
- [ ] **Step 2: Run; expect all pass; `rm -rf .smoke`; the cleanup log shows 0 rows left.**

### Task 8: Browser verification

- [ ] **Step 1:** Run `npm run dev` (port 9002) and open `/showcase/logs` in the browser pane.
- [ ] **Step 2: At mobile width 375 and desktop, check the console for errors and take screenshots of:**
  - hero rings, Net, streak and the typed line;
  - the weight chart with the goal ETA;
  - the week charts;
  - the day log;
  - the tiles, and a tile opening its sheet;
  - the Targets and Manage sheets;
  - the Log-it sheet opening in each mode.

  AI calls are blocked in showcase; check that this shows a friendly message.
- [ ] **Step 3: Check dark mode** (`colorScheme: 'dark'`), using the same screenshots.
- [ ] **Step 4:** Fix what is broken; re-run tsc and the build; commit.
