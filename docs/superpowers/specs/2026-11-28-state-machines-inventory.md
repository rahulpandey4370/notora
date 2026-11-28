# Implicit state machines: inventory

From a read-only survey of `src` on 2026-11-28 (commit 3e81c22). 183 app files, about 22 read in full, about 30 in part, the rest grep-scanned. `src/components/ui`, most of `src/ai/flows`, `src/ai/adk/notora-agent.ts` and `worker/index.js` were not opened.

**Found:** 22 implicit machines (below) and 9 already explicit ones. `useReducer` is used nowhere in app code.

Each bug is marked **(R)** if the surveyor read the code that causes it, **(I)** if inferred. Rows 3 and 5 were confirmed a second time while working in those files; the rest are unverified until each is worked on.

## Implicit machines

| # | Machine | Where | Encoded today as | Bugs it causes | Size |
|---|---------|-------|------------------|----------------|------|
| 1 | Workspace sync engine | `contexts/app-context.tsx` `AppProvider` | `data`, `loading`, `saveState` + refs `version`, `cachedVersion`, `pendingData`, `inFlight`, `saveTimer`, `holds`, `hasData` | (R) a reload that finds a new version drops the pending edit but leaves the indicator on "Saving…" for good; (R) a conflict sets "error", reloads fine, and stays "error"; (R) an edit made while the cached copy shows reads "Saving…" forever offline | L |
| 2 | Page load gate | `app/{logs,journal,links,profile,tasks}/page.tsx` | `loading \|\| !data \|\| !user` | (R) first load fails with no device cache → skeleton forever, no error | S |
| 3 | "Log it" session | `fit/LogSheet.tsx` | `open`, `view`, `msgs`, `text`, `interim`, `photo`, `draft`, `edits`, `busy`, `listening`, `saved`, `saving`, `ver`, `reqRef` | (R) close mid-request → `busy` never clears → on reopen "Reading…" spins and Send is disabled until reload; (R) `saved` is written, never read; (R) the save-to-My-Foods index survives a new reply and can point at a different meal | L |
| 4 | Speech capture | `LogSheet` `start`/`stop`, `notora/MicButton.tsx` | `listening`, `interim`, `recRef` | (I) an aborted recogniser's late `onend` can switch off the new one | S |
| 5 | Meal/workout edit session | `fit/ItemSheet.tsx` | `item`, `f`, `ask`, `busy`, `note`, `split`, `opened`, `amt`, `grams`, refs | (R) no request id: a late AI reply lands in another item's form; (I) a late split then replaces the wrong meal; (R) Save is enabled while the AI is busy; (R) the "replace with N items" note goes stale | M |
| 6 | Foods navigation | `fit/FoodsPanel.tsx` | `editing`, `detail`, `done`, `q`, `showHidden`; `AddFood`: `how`×`found`×`busy`×`error` | (R) the logged banner and its Undo never expire; (R) a lookup finishing after switching to Manual sets a hidden result | M |
| 7 | Foods data | `fit/useFoods.ts` | `status` + separate `error`; catalogue has no status | (R) empty catalogue = loading or failed, indistinguishable; (R) delete is optimistic with no rollback | S |
| 8 | Fitbit client | `fit/FitbitChip.tsx`, `notora/HealthConnectCard.tsx` | two copies of `HealthStatus\|null` + `busy` | (R) sync/disconnect in the card leaves the hero chip stale; (I) the OAuth result is only read when Manage trackers is opened | M |
| 9 | Push enable | `hooks/use-push-notifications.ts` (two users) | `PushStatus` + `busy` | (R) a dismissed permission prompt becomes "blocked"; (I) no service worker → "loading" forever; (R) the two instances don't share state | S |
| 10 | Password change, login | `ProfilePage`, `UserProfile`, `app/login/page.tsx` | `{busy?,msg?,ok?}` | (R) the dialog clears the fields even on failure; (R) a server error shows "Invalid email or password" | S |
| 11 | Journal day | `notora/JournalManager.tsx` | `selectedDate`, `isEditing`, `aiReflection`, `aiLoading` | (R) change the day mid-request → day A's reflection shows on day B | M |
| 12 | Note edit + AI | `StickyNote.tsx`, `FormattedNoteCard.tsx` | `isEditing`, edited fields, `aiLoading`, autosave timer | (R) Cancel does nothing after 1 s (autosave already wrote); (R) an AI result overwrites typing done meanwhile | S |
| 13 | Link add/analyze/search | `notora/LinkManager.tsx` | status stored in data as `summary:'Analyzing…'` | (R) `loading` is read, never set; (I) closing mid-analysis leaves "Analyzing…" saved; (R) stale search results apply after clearing | S |
| 14 | Chat | `notora/ContextualChatbot.tsx` | `isOpen`, `full`, `loading`, per-message `status`/`pending`/`result` | (R) "New chat" mid-reply puts the reply in the new chat | S |
| 15 | Auto-run AI dialogs | `DayEndSummaryDialog`, `WeeklyReviewDialog` | `loading`, result, `error` | (R) any data change while open re-runs the AI (and re-fires the notification) | S |
| 16 | On-demand AI lifecycle (8 sites) | `AiSummary`, `TrackerSheet`, `SmartEmptyState`, `TaskList`, `CustomPromptDialog`, `FoodEditor`/`AddFood`, `BodyCard` photos, `app/usage` | `busy`/`error`/result triples | (R) `TaskList` overwrites the title being typed; (R) failed photo URLs show "Loading…" forever | S each |
| 17 | Task status on a day | `app/tasks/page.tsx`, `Dashboard.tsx`, `CalendarAnalysis`, `notify/[slot]`, `lib/tasks.ts` | the same rules written four times | (R) Dashboard's overdue rule has no 11 PM grace, the tasks page does; (R) a weekly task ticked Monday shows unticked Tuesday | L |
| 18 | Repeating task lifecycle | `lib/tasks.ts`, `TaskSchema` | `ongoing` × `endsOn` × `type` × dates | none seen; contradictory combinations are storable | M |
| 19 | Journey status | `lib/journey.ts`, `ProgressHub` `JourneyCard` | `status` + `ratePerWeek` + `newLow` | (R) "New low" can show beside "Plateau"; (I) "losing" ignores a gain goal | S |
| 20 | Real burn "target set" | `ProgressHub.tsx` | `done` flag | (R) "This is your target ✓" goes stale | S |
| 21 | Data encoded in strings | ids `fitbit-`/`auto-`, meal names "Day total"/"Earlier total" | string prefixes and names | none seen | M |
| 22 | Smaller ones | FitnessPage overlays (5 flags), model store hydration, auth, `MealNameParts`, Ring/DayLog goal chains | separate flags | none seen | S each |

## Progress

**Batch 1 (2026-11-28), done:**

- **Row 2, page load gate:** `lib/page-gate` (loading / signedOut / failed / ready). A failed first load shows "Couldn't load your workspace · Try again".
- **Row 16, on-demand AI lifecycle:** `lib/ask` + `hooks/use-ask` (idle / pending / ready / failed, latest reply only). Converted: `TrackerSheet` insights, `AiSummary`, `SmartEmptyState`, the `AddFood` lookup. Not yet: `TaskList` title parsing, `CustomPromptDialog`, `FoodEditor` submit, `BodyCard` photos, `app/usage`.
- **Row 5, meal/workout edit:** "Edit with AI" runs on `lib/ask`; late replies are dropped, Save waits for the AI, a hand edit drops a proposed split and its note.
- **Row 3, "Log it" session:** `lib/log-session` (conversation, draft, edits, composing / awaiting, the open save-to-My-Foods editor). Closing mid-request no longer leaves it busy; a late reply is ignored; the editor closes when the draft is replaced; the unused `saved` flag is gone.
- **Row 6, in part:** a food lookup still running when you switch to Manual is dropped.

Each has a check script in `src/lib` (`page-gate`, `ask`, `log-session`). The live AI reply path was not run (no signed-in session in development); the transitions it uses are covered by the checks.

**Batch 2 (2026-11-28), done:**

- **Row 1, workspace sync engine:** `lib/sync-engine` holds one state (version on screen, cached version, pending edit, save out, server holds, last load, last save outcome, sign-in epoch) changed only by `syncStep`; the two branching points (after a load, after a conflict) return commands. `AppProvider` keeps it in a ref and still owns the network calls, the 600 ms debounce and the one-save-at-a-time ordering. The save indicator is derived by `saveStatus`.
- **Fixed, each with a failing check first:** the indicator stuck on "Saving…" after an unsaved edit was dropped by a reload; stuck on "Not saved" after a conflict reloaded fine; "Saving…" forever for an edit made on the cached copy while offline (now "Not saved" until the server answers).
- **Found and fixed (not in the survey):** a save still out at sign-out that failed after the next person signed in was re-queued and, on the next refocus, written into that person's workspace. Reproduced on the old code in a harness. Replies to anything started before a sign-out are now dropped, which also stops a late 401 from signing the next person out and a late success from re-creating the old account's device cache.
- **How it was compared:** the real provider was mounted with a fake signed-in user and a scripted `/api/data` (no real server call), and 16 scenarios were traced on the old and new code: edit, burst, edit during a save, failure then edit, failure then refocus, conflict, refocus, a server write with an edit during it, cache-first boots (same version, changed elsewhere, with an edit, offline), failed load then Retry, and two account switches. Ten traces are identical; six differ. Five of those are the fixes above; the sixth is a side effect, not a fix: the save made while signing out no longer flashes "Saved". The two plain cache-first boots show nothing about the cached copy (the load answered in the same tick); the three cache scenarios with an edit carry that evidence.
- **Account replaced directly:** logging in as someone else without signing out counts as a sign-out for the engine (`accountLeft`).
- **Not exercised:** the real server, first-ever workspace creation, and the real 401 sign-out path (that a late 401 no longer signs the next person out comes from reading the code).

**Still to do:** rows 4, 7–15, 17–22, the rest of rows 6 and 16.

## Already explicit (need nothing)

`RealBurn`, `HealthStatus`, `MatchResult`/`Amount`, `FoodsResult`, `SaveResult`, the upload result, `BurnInfo.source`, ProgressHub `Tab` and LogSheet `View`, the toast reducer, `ConfirmDelete`, `UpdatePrompt`.

Partly explicit (an enum plus a sidecar flag): `PushStatus`+`busy`, `FoodsApi.status`+`error`, `SaveState` over refs, `ChatMessage.status`, `Journey.status`, TrackerSheet `ai`.

## Conventions an explicit version should follow

- Pure logic in `src/lib/*.ts`, checked by `npx tsx src/lib/X.check.ts` (`node:assert/strict`, fixed `TODAY`); no test framework.
- Results as `{ ok: true … } | { ok: false … }`; discriminants named `kind` or `state`.
- Stale replies: a `reqRef` counter or a `let live` effect flag.
- zustand `persist` with `partialize` and `merge`.

## Not determined

Whether `reload()` can throw (HealthConnectCard spinner), the notify route's task filter, Radix unmount timing at runtime, and whether the speech `onend` race happens in practice.
