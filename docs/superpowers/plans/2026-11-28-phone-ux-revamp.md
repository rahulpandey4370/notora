# Phone UX Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make food logging, model choice and the progress journey work well on an iPhone home-screen app.

**Architecture:** Pure logic (amount scaling, journey window, model choice) goes in `src/lib` with `*.check.ts` scripts; screens in `src/components/fit` and `src/components/notora` call it. One modal at a time: the food detail is a screen inside the Log it sheet, not a second sheet.

**Tech Stack:** Next.js 15, React, Tailwind 3.4, zustand (persist), Radix sheet/dialog, `npx tsx` check scripts.

**Spec:** `docs/superpowers/specs/2026-11-28-phone-ux-revamp-design.md`

## Global Constraints

- Tap targets in touched screens: at least 44×44 px (`h-11 w-11`, `.f-chip` default height).
- Form fields stay 16px (existing iOS rule in `globals.css`).
- No new dependencies. No secrets in output.
- Run checks with `npx tsx src/lib/<name>.check.ts`; `npx tsc --noEmit` must stay at 15 pre-existing errors.
- Commit only when the user asks.

## Review Focus

- A logged meal whose food was deleted or hidden: editing its amount must still scale (by weight or multiplier), never zero the numbers.
- Quantity field empty or 0 while typing: show "Enter an amount", keep Add/Save from writing zeros.
- Journey window with fewer than 2 weigh-ins: fall back to all time instead of showing nothing.
- A saved model that is no longer on offer (provider removed): fall back to the default, don't send a dead id.
- Quick-add then Undo after another food was added: Undo removes only its own meal.

---

### Task 1: Log it sheet at the top (DONE, uncommitted)
**Files:** Modify `src/components/fit/LogSheet.tsx`
- [ ] `SheetContent side="top"`, floating card: top `max(0.5rem, env(safe-area-inset-top))`, side margins 0.5rem, `rounded-[28px]`, max-height = visible height minus keyboard (`--kb`) minus 1rem; centred `max-w-lg` on desktop.
- [ ] AI view order: header, composer, then messages/draft (so the keyboard never moves the box).
- [ ] Check at 375×812: sheet top within 16px of the top; no sideways scroll.

### Task 2: Model per area, in settings (DONE, uncommitted)
**Files:** Modify `src/lib/model-catalog.ts`, `src/hooks/use-model-store.ts`, `src/components/notora/Header.tsx`, `src/components/notora/UserProfile.tsx`, 17 call sites; Create `src/components/notora/AiModelsDialog.tsx`; Test `src/lib/model-catalog.check.ts`
**Interfaces (produces):**
- `type ModelArea = 'food' | 'chat' | 'notes' | 'journal' | 'tasks' | 'summaries'`, `MODEL_AREAS: { id: ModelArea; label: string; hint: string }[]`
- `modelForArea(models: CatalogModel[], fallback: string, override?: string | null): string` in model-catalog.ts
- store: `areaModels: Partial<Record<ModelArea, string>>`, `setAreaModel(area, key | null)`; hook `useModelFor(area): string`
- [ ] Check: override on offer → override; override not on offer or unset → fallback.
- [ ] Persist `areaModels` with `pickedModel`; replace every `selectedModel` read at AI call sites with `useModelFor(<area>)`.
- [ ] `AiModelsDialog`: native `<select>` per row (default + six areas, "Same as default" first), grouped by provider; opened from the avatar menu.
- [ ] Header: remove the model dropdown; Day End Summary and Weekly Review buttons `hidden md:inline-flex`, the same two as avatar-menu items on phones; header buttons 44px on phones.

### Task 3: Amount logic shared by add and edit (DONE, uncommitted)
**Files:** Modify `src/lib/food-match.ts`; Test `src/lib/food-match.check.ts`
**Interfaces (produces):**
- `measuresFor(f: Food): { id: string; label: string; grams?: number }[]` (`'grams'`, `'s:<label>'`, or `'serving'`)
- `amountOf(unitId: string, qty: number): Amount`
- `defaultAmount(f: Food): { unit: string; qty: number }` (first serving ×1, else 100 g/ml, else 1 serving)
- `guessAmount(f: Food, meal: { name: string; grams?: number }): { unit: string; qty: number }` (serving count only when the name has "× n" and grams ÷ serving is a multiple of 0.25; else grams; else default)
- `rescaleMeal<T extends { kcal; proteinG; carbsG?; fatG?; fiberG?; grams?; name }>(m: T, factor: number): T` (numbers × factor, grams × factor, "N g|ml" in the name updated)
- [ ] Checks: roti (1 roti = 40 g) logged "× 2 (80 g)" guesses 2 × roti; "…, 150 g" guesses 150 g; rescale 120 ml → 180 ml multiplies kcal by 1.5 and renames; factor from a hidden/deleted food still works.

### Task 4: Food list and detail screen (DONE, uncommitted)
**Files:** Modify `src/components/fit/FoodsPanel.tsx`, `src/components/fit/LogSheet.tsx`, `src/components/fit/FitnessPage.tsx`
**Interfaces:** `FoodsPanel.onSave?: (d: FitnessDraft) => string[] | void` (ids of meals added); `onUndo?: (mealIds: string[]) => void`; export `QtyMeasure({ qty, unit, measures, onQty, onUnit })`.
- [ ] Row: name `line-clamp-2`, sub-line default serving, kcal at right, 44px "+" quick-add (not in manage mode). Tap row → detail.
- [ ] Detail: Back, full name (selectable), kcal + P/C/F/fibre for the amount, split bar, `QtyMeasure` with − / + and quick chips, per-100 reference, meal picker, sticky "Add to <meal>", then Edit/Copy and Delete/Remove.
- [ ] "Frequent" section (top 6 by use, this meal first) when not searching.
- [ ] Logged message with Undo calling `onUndo(ids)`.

### Task 5: Quantity and measure when editing a meal (DONE, uncommitted)
**Files:** Modify `src/components/fit/ItemSheet.tsx`, `src/components/fit/FitnessPage.tsx`, `src/lib/fitness.ts` (`editDayItem` keeps `grams`)
- [ ] ItemSheet gets `foods: FoodsApi`. With a known food: `QtyMeasure` from `measuresFor`, start from `guessAmount`, change → `scaleFood`. Without: grams when known (`rescaleMeal`), else "× portion".
- [ ] Save sends `grams`.

### Task 6: Journey from a chosen start (DONE, uncommitted)
**Files:** Modify `src/lib/types.ts` (`AppData.journeyFrom?: string`), `src/lib/journey.ts`, `src/components/fit/ProgressHub.tsx`; Test `src/lib/journey.check.ts`
**Interfaces:** `journeyFrom`: `'all' | '30d' | '90d' | '180d' | 'YYYY-MM-DD'`, default `'90d'`; `journey(data, today)` reads it; start weight = trend on the first point on or after the start.
- [ ] Checks: 400 days of data with `'90d'` starts 90 days back; fewer than 2 points in the window falls back to all time; `'all'` matches the old result.
- [ ] Journey card: chips Last 30 / 90 / 180 days / All time / From a date.

### Task 7: Smaller fixes (DONE, uncommitted)
**Files:** `src/components/fit/LogSheet.tsx` (draft card two rows), `src/components/fit/DayLog.tsx` (names `line-clamp-2`), fitness components with `h-9 w-9` / `!min-h-8|9` controls → 44px; Create `src/components/providers/update-prompt.tsx`, mount in `src/app/layout.tsx`.
- [ ] Update prompt: on `controllerchange` (when a controller already existed) show "New version ready · Refresh"; on return to the app call `registration.update()`.

### Task 8: Verify (DONE; review findings 1-7 fixed, uncommitted)
- [ ] All check scripts pass; `tsc` error count unchanged; phone-size walkthrough of Log it (AI, foods, detail, quick-add + undo), meal edit, journey chips, avatar menu.
