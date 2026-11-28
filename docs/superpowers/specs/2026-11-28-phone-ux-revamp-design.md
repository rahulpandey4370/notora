# Phone UX revamp: food logging, model settings, progress journey

Approved in chat on 2026-11-28 ("Fix 1 to 4 and also these", plus Log it at the top).

## Why
The app is used mostly as an iPhone home-screen web app. Food names are cut off, there is no
way to see a food's details before logging it or to change a logged food's amount, the model
picker is in the top bar and didn't stick, and the journey measures from a weigh-in 500 days old.

## Goals
1. **AI models in settings.** An "AI models" dialog in the avatar menu replaces the top-bar picker:
   one default model plus an optional model per area (food log, chat, notes, journal, tasks and
   links, summaries). Saved per device (localStorage).
2. **Food logging, HealthifyMe pattern.** List rows: name wraps to two lines, default serving and
   its kcal, a "+" that logs the default serving at once (with Undo). Tapping the row opens a
   detail screen: full name, kcal and macros for the chosen amount, quantity stepper, measure
   picker (g/ml or any serving), meal, one large "Add to <meal>" button. A "Frequent" section
   comes first when not searching.
3. **Edit a logged food's amount.** Meal details gets the same quantity + measure fields; changing
   them recalculates kcal and macros. Meals with no known food scale by weight when the weight is
   known, else by a portion multiplier.
4. **Journey relevant to now.** The journey measures from a start the user chooses: last 30 / 90 /
   180 days, all time, or a date. Default: last 90 days.
5. **Log it opens at the top** of the screen, so the keyboard opening doesn't move it.
6. **Smaller fixes.** AI draft card laid out in two rows; day-view meal names wrap; Day End Summary
   and Weekly Review move into the avatar menu on phones; tap targets under 44px in the fitness
   screens and top bar raised to 44px; a "new version, tap to refresh" prompt.

## Non-goals
- Syncing the model choice across devices (upgrade path: store it in the user's data).
- A pixel copy of HealthifyMe: only its search list could be confirmed from published
  screenshots; the detail and edit screens are our own design in this app's look.
- Multi-select "add several, then Done": each food logs when added, the sheet stays open.

## Approaches considered
- **Food detail as an in-sheet screen (chosen)** vs a second stacked sheet vs the old inline
  expander. A second sheet stacks modals (NN/g advises against it); the inline expander is what
  hid the full name. An in-sheet screen with Back keeps one modal.
- **Model choice via one hook `useModelFor(area)` (chosen)** vs a picker on every AI screen: one
  place to manage, 17 call sites change one line each.
- **Journey start as a setting on the weight tracker (chosen)** vs deriving it from the goal's
  set date: no goal date is stored, and a chosen window is explicit.

## Calls made by the builder
- Amount shown when editing: grams/ml when known; a serving count only when the meal's name is in
  the "× n" form the app writes.
- Undo for quick-add removes the meal just added.
- The update prompt can't be exercised in dev (the service worker is off there).
