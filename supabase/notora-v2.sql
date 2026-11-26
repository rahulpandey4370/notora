-- Notora v2: lock down tables, push notifications, Fitbit (Google Health) sync.
-- Run once in the Supabase SQL Editor AFTER schema.sql. Safe to re-run.
-- Then run the cron block at the bottom with your app URL and CRON_SECRET filled in.

-- ---------------------------------------------------------------------------
-- 1. Lock down. The app talks to Supabase only with the service-role key
--    (server-side), which bypasses RLS. schema.sql granted the public anon key
--    full access to every notora table, so anyone holding that key could read
--    password hashes and all notes. RLS with no policies blocks anon/authenticated.
-- ---------------------------------------------------------------------------
alter table notora.app_data enable row level security;
alter table notora.users enable row level security;
revoke all on all tables in schema notora from anon, authenticated;
alter default privileges in schema notora revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Push notifications. One row per device; a device belongs to one user.
-- ---------------------------------------------------------------------------
create table if not exists notora.push_subscriptions (
  endpoint text primary key,
  username text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_username_idx on notora.push_subscriptions (username);

-- Keys of notifications already sent (e.g. morning:rahul:2026-11-26), so a
-- retried cron run never notifies twice.
create table if not exists notora.notification_log (
  key text primary key,
  sent_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Fitbit via Google Health API.
-- ---------------------------------------------------------------------------
create table if not exists notora.health_connections (
  username text primary key,
  refresh_token text not null,
  access_token text,
  access_expires_at timestamptz,
  status text not null default 'connected' check (status in ('connected', 'reconnect')),
  last_sync_at timestamptz,
  last_error text,
  connected_at timestamptz not null default now()
);

-- One row per user per day; merged into the Steps / Sleep / Resting heart rate
-- log trackers when the app loads. Sleep is credited to the day you woke up.
create table if not exists notora.health_daily (
  username text not null,
  date date not null,
  steps integer,
  sleep_minutes integer,
  resting_hr integer,
  updated_at timestamptz not null default now(),
  primary key (username, date)
);

alter table notora.push_subscriptions enable row level security;
alter table notora.notification_log enable row level security;
alter table notora.health_connections enable row level security;
alter table notora.health_daily enable row level security;
grant all on notora.push_subscriptions, notora.notification_log, notora.health_connections, notora.health_daily to service_role;

-- ---------------------------------------------------------------------------
-- 4. AI usage & cost (same table as ai-expense-tracker's supabase/usage.sql,
--    plus the username). One row per AI model call; read by the Usage page.
-- ---------------------------------------------------------------------------
create table if not exists notora.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  username text,                    -- null for scheduled jobs
  feature text not null,            -- chat, polish-sticky-note, weekly-review, …
  model_key text not null,          -- e.g. openai::gpt-6.2-sol
  provider text not null,
  operation text not null,          -- structured | chat | tool_chat
  input_tokens integer not null default 0,   -- all input, cached included
  cached_tokens integer not null default 0,  -- input read from the provider's cache
  output_tokens integer not null default 0,  -- reasoning included
  reasoning_tokens integer not null default 0,
  cost_usd numeric(14, 8),          -- null when the model has no price in the catalog
  latency_ms integer not null default 0,
  ok boolean not null default true,
  error text
);
create index if not exists ai_usage_created_at_idx on notora.ai_usage (created_at desc);
alter table notora.ai_usage enable row level security;
grant all on notora.ai_usage to service_role;


-- ---------------------------------------------------------------------------
-- 5. Scheduled notifications (IST). Job names are prefixed "notora-" because
--    this Supabase project also runs ai-expense-tracker's "finwise-daily-9pm";
--    cron.schedule replaces a job with the same name.
--    Replace YOUR_CRON_SECRET (your CRON_SECRET from Vercel), then run this block.
--    To change later: select cron.unschedule('notora-morning'); and re-run.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 7:30 AM IST = 02:00 UTC: sync Fitbit, then today's plan + last night's sleep.
select cron.schedule('notora-morning', '0 2 * * *', $$
  select net.http_post(
    url := 'https://notora-ai.vercel.app/api/notify/morning',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

-- 9:00 PM IST = 15:30 UTC: open tasks + journal nudge.
select cron.schedule('notora-evening', '30 15 * * *', $$
  select net.http_post(
    url := 'https://notora-ai.vercel.app/api/notify/evening',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
