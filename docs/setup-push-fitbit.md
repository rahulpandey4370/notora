# Notora: push notifications, Fitbit sync, and the security update

How it fits together:

```
Fitbit band ─► Google Health app on your phone ─► Google's servers
                                                     │ (Google Health API, OAuth)
Supabase pg_cron 7:30 AM IST ─► POST /api/notify/morning ─► sync Fitbit ─► notora.health_daily ─► push "☀️ 4 tasks today · Slept 7h 12m"
Supabase pg_cron 9:00 PM IST ─► POST /api/notify/evening ─► push "🌙 2 tasks still open · journal?"
Logs page ─► Connect / Sync now ─► health_daily ─► merged into Steps / Sleep / Resting heart rate trackers on load
```

Everything new switches itself off until its env vars are set, so deploying before finishing this setup is safe. **Step A is not optional**: it closes a hole where the public Supabase key could read every table.

---

## A. Supabase (one time, required)

1. Open `supabase/notora-v2.sql`. In the cron block at the bottom, replace `YOUR_CRON_SECRET` with your `CRON_SECRET` (from B.2).
2. Supabase dashboard → **SQL Editor** → New query → paste the whole file → **Run**.
3. Check: `select jobname, schedule from cron.job;` should list `notora-morning` and `notora-evening` **and still** `finwise-daily-9pm` (the expense tracker's job, untouched).

## B. Vercel environment variables (Production)

1. VAPID keys for push, on your Mac in this repo:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Two random secrets (run twice):
   ```bash
   openssl rand -hex 32
   ```
3. Add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public Key from 1 |
   | `VAPID_PRIVATE_KEY` | Private Key from 1 |
   | `VAPID_SUBJECT` | `https://notora-ai.vercel.app` |
   | `CRON_SECRET` | first secret from 2 (same value as in the SQL) |
   | `SESSION_SECRET` | second secret from 2 (optional: falls back to one derived from `SUPABASE_SERVICE_ROLE_KEY`) |
   | `GOOGLE_HEALTH_CLIENT_ID` | from C |
   | `GOOGLE_HEALTH_CLIENT_SECRET` | from C |
   | `APP_TIMEZONE` | optional, default `Asia/Kolkata` |

   You can reuse the expense tracker's VAPID keys, but separate ones keep the apps independent.
4. **Redeploy** (`NEXT_PUBLIC_*` is baked in at build time).
5. Everyone signs in once more after this deploy: sessions moved from browser storage to a secure cookie.

## C. Google Cloud: Fitbit via Google Health API

Before starting: your Fitbit must already be on a **Google account** (Fitbit migrated to Google / signed in to the Google Health app with that account). If it isn't, connecting shows "no Google Health profile yet".

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. `notora-health`).
2. **APIs & Services → Library** → search **Google Health API** → **Enable**.
3. **Google Auth Platform → Branding**: app name `Notora`, your email as support/developer contact.
4. **Audience**: User type **External**, Publishing status **Testing**. Under **Test users**, add the Google account(s) your Fitbit uses.
5. **Data Access → Add or remove scopes**: add
   - `.../auth/googlehealth.activity_and_fitness.readonly`
   - `.../auth/googlehealth.sleep.readonly`
   - `.../auth/googlehealth.health_metrics_and_measurements.readonly`
6. **Clients → Create client** → Web application. Authorized redirect URI:
   `https://notora-ai.vercel.app/api/health/callback` (add `http://localhost:9002/api/health/callback` too for local dev).
   Copy the client ID and secret into B.3.
7. In Notora: **Logs** → **Fitbit** card → **Connect** → pick your Google account → allow. It backfills 30 days.

**The 7-day limit (confirmed in Google's setup docs):** while the app is in *Testing*, Google expires the connection after 7 days. Notora then shows **Reconnect** on the Logs page and sends a "⌚ Reconnect Fitbit" push the next morning: one tap, about 10 seconds. Google's docs say tokens from apps **In production** don't expire this way, and unverified apps are capped at 100 users. They don't say whether an unverified app may use these restricted health scopes in production. Worth one try: **Audience → Publish app** without submitting for verification, then reconnect. If Google blocks the sign-in, switch back to **Testing** and live with the weekly reconnect.

Connect once from a laptop if the iPhone Home Screen app's Google sign-in misbehaves: the connection is stored per user on the server, so it covers every device.

Data arrives only after the official app has synced from the band, so it can be minutes to hours behind. Steps are per day; sleep is credited to the day you woke up; a day you logged by hand keeps your value.

## D. iPhone: turn on notifications

Web Push on iPhone works only from the **Home Screen app** (iOS 16.4+).

1. Safari → your Notora URL → **Share → Add to Home Screen**.
2. Open Notora from the Home Screen icon and sign in.
3. Avatar (top right) → **Enable notifications** → **Allow**. A "✅ Notora notifications are on" test arrives within seconds.

## Test without waiting

```bash
curl -X POST https://notora-ai.vercel.app/api/notify/morning -H "Authorization: Bearer YOUR_CRON_SECRET"
```
The JSON reply says, per user, whether Fitbit synced and whether a notification was sent. Each slot sends at most once per user per day, so a second run reports "already sent".

## AI usage & cost, and the ADK assistant

- **Usage page:** avatar → **AI usage & cost**. Every AI call (all the note/journal/task tools and the chat) is recorded in `notora.ai_usage` with tokens, estimated cost, speed and errors: the same code as FinWise. Created by section 5 of `supabase/notora-v2.sql`. OpenAI and Claude calls are priced from the model catalog; Gemini and Azure count tokens only.
- **Chat assistant** (bottom-right bubble) now runs on Google ADK, like FinWise's chat. It can search everything, read your trackers and journal, and add a task or save a note when you ask. With a Gemini model it needs `GEMINI_API_KEY` (already used by the app).

## What was not tested live

Checked locally: the production build passes, type errors are unchanged from before, the sign-in cookie / scheduled-route secret / Fitbit connect redirect behave correctly, and the Fitbit parsers (`npx tsx src/lib/health-merge.check.ts`) and FinWise's usage tests (`npx tsx --test src/lib/usage.test.ts`) pass.

**Run against the real Supabase and OpenAI (GPT-6 Luna), 26 Nov 2026:** every AI flow in `src/ai/flows` (meal calories from text, photo, and both; daily calorie balance; all note, journal, task, log and link tools; weekly review), the ADK chat (search, read trackers, add a task that is saved), the sign-in check refusing AI calls without a session, and a save from a stale version being refused. The flows were called directly with a stubbed cookie, on a throwaway workspace that was deleted afterwards; the browser, real login and server-action transport were not part of that run. Claude and Gemini models were not run.

**Not yet run:** the usage recorder actually saving rows (needs `ai_usage` from step A; until then the Usage page shows an error and the server logs `[usage] could not record`), the Google Health API calls, and real push delivery. Before merging to master, smoke-test on a preview deploy:

1. Sign in, edit a note, reload: the edit is still there.
2. Edit on a second device, then edit the first one: you get "Updated on another device" (not a silent overwrite).
3. Run one AI tool (e.g. Polish a note) and send one chat message asking it to add a task: the task appears.
4. Open **AI usage & cost**: both calls are listed.
5. Enable notifications (test arrives), connect Fitbit, press **Sync now**.

If **Sync now** reports an error, its message includes Google's reply (never tokens): that's the first thing to look at.
