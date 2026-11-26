# Logs page: fitness-tracker redesign

Date: 2026-11-26 · Status: draft for approval

## Intent

The Logs page is where Rahul tracks **weight loss, general health and fitness**: Weight, Protein, Steps, Calories in, Calories burned, plus Sleep and Resting heart rate now arriving from Fitbit. Today it reads like a form (streak card, Fitbit card, AI text box, an always-open "Manage Trackers" form, one line chart per tracker, an AI Calorie Coach in tabs). Logging stopped on 31 Aug 2026. The redesign should make it feel like a real fitness tracker: at a glance "how am I doing today, am I trending the right way", and logging food and exercise should be as quick as saying it, typing it or snapping it.

## Goals

- At a glance, today: steps, protein and calorie rings against targets; net calories; last night's sleep and resting heart rate.
- Weight shown the way the best diet apps do it: a smoothed **trend weight**, change per week, and an estimated date to reach the goal.
- One **chat-style log sheet** (type, speak, or photo) that handles intake *and* burn in one go: meals, workouts, workout-summary screenshots, and plain values ("94.1 kg, 110 g protein"). The AI answers with editable cards; **Save** writes them.
- A visual identity of its own for this page, borrowed from FinWise's split page: soft tinted hero card, serif display font with italic accents, typed AI line, round capture buttons, light and dark mode.
- Works first on iPhone (Home Screen app), and well on desktop.

## Non-goals

- New Fitbit metrics (e.g. Fitbit's own calories burned), workout plans, social, badges.
- Changing other pages (Notes, Tasks, Journal, Links) or the app shell.
- Replacing Notora's model picker: the page uses the model already selected in the app.

## Anti-goals (a failure even if it works)

- Logging becomes slower than today's one-line text box.
- Burn gets double-counted (workout added on top of a total that already included it), or a manual value gets silently overwritten.
- Existing trackers or their 1,000+ entries change, disappear or are rewritten.

## Constraints and facts

- Data lives in `AppData` (`src/lib/types.ts`), saved through the versioned save in `app-context.tsx` (conflict-safe). Trackers: `LogTracker { name, unit, goal?, logs: LogEntry[], healthMetric? }`; `LogEntry { date 'yyyy-MM-dd', value, notes?, activityNotes? }`.
- Rahul's trackers are found **by name** today: `Weight`, `Protein Intake`, `Steps`, `Daily Calorie Intake`, `Calories Burned` (other code already relies on these names). Fitbit ones carry `healthMetric` (`steps`, `sleep`, `restingHr`).
- **Calories Burned is a full-day total** (median ~2,650 kcal; most entries have `activityNotes`), written today by the AI Calorie Coach's "Analyze balance" (BMR + steps + activities).
- **No tracker has a goal.** Rings need targets.
- Body stats (age, sex, height) live only in `localStorage` (`notora-user-stats`), so they don't follow the user between devices.
- AI calls go through `callStructuredLLM` (now sends the output JSON schema), are tracked in `ai_usage`, and must pass `requireUser()`. Tested model: GPT-6 Luna. Photos must be downscaled on the client (server-action 1 MB limit).
- Libraries already present: recharts, framer-motion, date-fns, lucide, shadcn/ui (Sheet, Dialog, Tabs…). Showcase mode renders the Logs page with demo data and no AI.

## Approaches considered

1. **Dedicated fitness look for this page (chosen).** Scoped CSS tokens and a serif display font, copied from FinWise's `split.css` approach; new hero, rings, trend chart, week charts, tiles, chat sheet. Most "fitness app" feel; looks different from the rest of Notora by design.
2. Same features in Notora's existing theme. Consistent with other pages, less distinct.
3. Restyle the existing cards in place. Least work, but keeps the form-like structure the user wants gone.

Rahul picked **1**.

## Design

### Page layout (top to bottom; single column on phone, two columns from `lg`)

```
┌ HERO ─────────────────────────────────────────────┐
│ Today · Thu 26 Nov            🔥 12-day streak  ⌚ Fitbit · 2h ago ⟳ │
│   ◯ Steps 8.2k/10k   ◯ Protein 92/150g   ◯ Kcal 1,650/2,200       │
│   Net −420 kcal · Slept 7h 12m · RHR 58                          │
│   "Had *2* rotis and dal, walked *40* min▍"   (typed AI line)     │
│   [📷]                                   [✏️]  [🎙]               │
└───────────────────────────────────────────────────┘
┌ WEIGHT ───────────────────────────────────────────┐
│ Trend 93.4 kg  ▼0.5 kg/week · goal 85 kg ≈ 14 Mar │
│ [dots = weigh-ins, line = trend, dashed = goal; 30d/90d/All]      │
└───────────────────────────────────────────────────┘
┌ THIS WEEK ─────────────┐ ┌ ───────────────────────┐
│ Calories in vs burned  │ │ Steps (bars + goal)    │
│ (paired bars, net/day) │ │ Sleep (bars, h)        │
└────────────────────────┘ └────────────────────────┘
┌ TODAY'S LOG ──────────────────────────────────────┐
│ 🍛 Lunch: dal, 2 rotis  +450   🏃 Jog 30 min  −320  · tap to edit │
└───────────────────────────────────────────────────┘
┌ TRACKERS ─────────────────────── [Manage] ────────┐
│ tiles: name, latest value, 14-day sparkline, ▲▼ vs last week      │
│ tap → sheet with the existing full card (30-day chart, insights,  │
│ all logs, AI insights)                                            │
└───────────────────────────────────────────────────┘
```

- **Day picker**: the hero's date is tappable (yesterday / pick a date) so missed days can be filled in; everything on the page follows the chosen day.
- **Empty and first-run**: if targets or profile are missing, the hero's rings show a "Set targets" state that opens the Targets sheet (below). Days with no data show "—" and invite a log, never zeros.
- **Fitbit**: becomes a small status chip in the hero (synced X ago, tap to sync, Reconnect when needed); the connect/disconnect card moves into the Manage sheet.

### Rings (today, or the picked day)

| Ring | Value | Target |
|---|---|---|
| Steps | Steps tracker value for the day (Fitbit or manual) | Steps goal (suggested 10,000) |
| Protein | Protein Intake for the day | Protein goal (suggested 1.6 g × trend weight) |
| Calories | Daily Calorie Intake for the day | Calorie target (suggested burn estimate − 500) |

Ring colour: accent while under target; the calorie ring turns coral when intake goes over target (over is bad for calories, good for steps and protein). Below the rings: **Net** = intake − burned, green when in deficit, coral in surplus.

### Weight trend (pure math, unit-tested)

- Trend weight = exponential moving average of weigh-ins (α = 0.1, gaps carried forward), the approach popularised by The Hacker's Diet and used by MacroFactor-style apps.
- Weekly rate = slope of trend over the last 28 days (least squares), shown as kg/week.
- Goal ETA = (trend − goal) / rate, shown only when moving toward the goal at ≥ 0.05 kg/week; otherwise "not trending toward goal yet".
- Chart: daily weigh-ins as dots, trend as a line, goal as a dashed line; 30d / 90d / All.

### Data model and rules (builder-check answers; Claude's calls, marked ⚙)

**Structured day log** ⚙. New optional `AppData.fitnessDays: Record<'yyyy-MM-dd', { meals: Meal[]; activities: Activity[] }>`:
- `Meal { id, name, kcal, proteinG }`
- `Activity { id, name, minutes, kcal, stepBased: boolean }`

This is what "Today's log" lists and edits. The existing trackers stay the source every other screen reads (charts, `CalendarAnalysis`, insights), so a save from this page also writes that day's derived tracker entries.

**Telling entries apart** ⚙. Entries are identified by id prefix, so `LogEntry` needs no new field:
- Derived entries use `auto-intake-<date>`, `auto-protein-<date>` and `auto-burn-<date>`.
- Fitbit entries keep `fitbit-<metric>-<date>`.
- Every other id is a stored total and is never rewritten by derivation. That includes all existing Calories Burned entries, the old AI-estimated totals.
- A stored entry with value 0 counts as "no entry". Old notes-only burn rows were saved as 0.

**Intake and protein** ⚙
- A day with meals: Daily Calorie Intake = Σ meal kcal and Protein Intake = Σ meal protein, written as the `auto-*` entries.
- The first meal added to a day that already has a hand-typed total turns that total into a meal item called "Earlier total", so nothing is lost or double-counted.
- Editing or deleting a meal recomputes the totals.

**Burn: computed live, persisted on save** ⚙
- Day burn = stored total (if any) + Σ non-counted activities.
- Days without a stored total use base + Σ non-counted activities, where base = BMR (Mifflin-St Jeor from profile and the day's weight, else trend weight) + steps × 0.0005 × kg.
- The page always shows the live number, so Fitbit steps growing during the day update it.
- A save from this page also writes `auto-burn-<date>` so other screens have a value. That value can lag Fitbit steps until the next save, which is acceptable.
- Days with no activity still get base burn. No profile means burn is unknown: Net shows "—" and invites the user to set up their profile.

**No double counting with steps** ⚙
- Walks, runs and hikes are `stepBased`. On a day that has step data (Fitbit or manual), they are listed with "counted in your steps" and left out of the burn sum. On a day with no step data they count.
- Workout screenshots: the AI must use *active* kcal. If only total kcal is shown, active ≈ total − BMR × minutes / 1440.

**Plain values replace; meals and activities add** ⚙
- A bare number for a tracker ("ate 2100", "110 g protein", "burned 2600", "12k steps", "94.1 kg") replaces that day's value, as `parseLogEntry` does today.
- The draft card says so: "replaces 1,650 kcal".
- A typed intake or protein total clears that day's meal items into one "Day total" item. The card warns about this.
- A typed burn total becomes a stored total. Activities logged afterwards add on top.
- A typed step count overrides Fitbit for that day (the existing merge rule). The card says "Fitbit won't update this day".

**Suggested calorie target** ⚙ = average burn over the last 14 days that have a burn value, minus 500, rounded to 50.

### Burn model summary

The old "Analyze balance" BMR/TDEE AI step goes away; burn now comes from the deterministic rules above, unit-tested in a pure module next to the trend-weight math.

### Chat log sheet ("Log it")

- Opened by the hero's ✏️ (type), 🎙 (speak: browser speech recognition, like FinWise's voice sheet; falls back to typing where unsupported) or 📷 (photo; downscaled on the client).
- Conversation thread in a bottom sheet. Each user message (text and/or one photo) goes to one new AI flow that returns:
  - `date` (defaults to the picked day; understands "yesterday"),
  - `meals[]`: name, kcal, protein g,
  - `activities[]`: name, minutes, kcal (estimated from profile weight; read straight from a workout-summary screenshot when shown),
  - `values[]`: trackerId + value for other trackers (weight, water…),
  - a one-line reply.
- The reply renders as **draft cards** (meal / activity / value) with editable numbers and a remove ×; **Save** writes them all in one versioned save, then the sheet shows "Saved ✓" and the page updates. Nothing is written before Save.
- Meals and activities are saved into `fitnessDays` and the derived tracker entries, following the rules above.
- Follow-up messages in the same sheet can correct the draft ("make it 3 rotis").
- The existing meal photo analysis and "Log your day" text box are folded into this sheet.

### Targets and profile sheet

- Age, sex and height (moved from `localStorage` into `AppData` so every device has them; imported once from the old key if present), plus goals: weight goal, calorie target, protein target, steps target. Suggestions are pre-filled, and the user can override them.
- Goals are stored as the existing `goal` field on the matching trackers; profile as a new optional `AppData.fitnessProfile`.

### Manage sheet

- The current "create a tracker" form, the list of trackers (rename, goal, unit, delete) and the Fitbit connect card. Moves out of the main page.

### Visual style

- Scoped `fit-ui` tokens adapted from FinWise `split.css`: teal accent, coral for over or surplus, green for good, soft tinted hero gradient, 22–26 px card radii, `Newsreader` serif for display numbers and headings with italic accents, Geist/system for body. Full dark-mode token set.
- Motion: rings fill and typed line animate in; both respect `prefers-reduced-motion`.
- Accessibility: rings and charts have text equivalents ("Steps 8,200 of 10,000, 82%"); tap targets ≥ 44 px; colour never the only signal (▲▼ and words alongside).

## What happens to existing components

- Removed from the page: `LogStreakDisplay` (streak moves into the hero), `AddNewLogCard` and `AICalorieCoach` (folded into the chat sheet and burn model), the always-open `LogManager` form (moves into the Manage sheet). Files are deleted if nothing else uses them; only the Logs page does today.
- Reused: `LogTrackerCard` (inside the tracker detail sheet), `HealthConnectCard` logic (chip plus Manage sheet), `parseLogEntry` and `analyzeFoodCalories` prompts as starting points for the new flow.
- Showcase mode keeps working with demo data; AI buttons show the existing "sign in to use AI" behaviour.

## Decided by Rahul

- Option 1 (dedicated fitness look), page-specific.
- Focus: weight loss, general health, fitness.
- Chat-based and photo-based logging for both intake and burn, modelled on FinWise split.

## Claude's calls (check these)

Every ⚙ rule under "Data model and rules":
- Structured `fitnessDays`.
- Entries told apart by id prefix.
- Live burn, persisted when you save.
- Step-based workouts not counted twice.
- Plain numbers replace, while meals and workouts add.
- Calorie target = burn − 500.

## Left to the builder

- Exact component split and file names under `src/components/fit/`.
- Chart details within recharts (colours from the tokens, tooltips).
- Prompt wording for the new flow (it must return the schema above; test with GPT-6 Luna).
- Animation timings.
