-- Notora v5: My Foods library + meal-time reminders. Run once in the Supabase
-- SQL Editor. Safe to re-run. Replace YOUR_CRON_SECRET in part 2 first.
-- (Progress photos need no SQL: the app creates its private bucket on first upload.)

-- ---------------------------------------------------------------------------
-- 1. My Foods: items you've saved with exact nutrition, so logging them needs
--    no AI. Values are per 100 g (unit 'g'), per 100 ml ('ml') or per 1 serving
--    ('serving'). servings = handy amounts, e.g. [{"label":"roti","amount":40}].
--    The app reads and writes this only server-side, as the signed-in user.
-- ---------------------------------------------------------------------------
create table if not exists notora.foods (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  name text not null,
  aliases text[] not null default '{}',
  unit text not null default 'g' check (unit in ('g', 'ml', 'serving')),
  kcal numeric not null default 0 check (kcal >= 0),
  protein_g numeric not null default 0 check (protein_g >= 0),
  carbs_g numeric not null default 0 check (carbs_g >= 0),
  fat_g numeric not null default 0 check (fat_g >= 0),
  fiber_g numeric not null default 0 check (fiber_g >= 0),
  servings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists foods_user_name on notora.foods (username, lower(name));
alter table notora.foods enable row level security;
revoke all on notora.foods from anon, authenticated;
grant all on notora.foods to service_role;

-- ---------------------------------------------------------------------------
-- 2. Meal-time reminders. One job every 30 minutes; the schedule itself lives
--    in the app (src/lib/reminders.ts), so changing times needs no SQL:
--      10:00 breakfast + weigh-in, 11:30 morning snack, 13:00 lunch,
--      19:00 evening snack, 20:30 close the day, 22:00 dinner,
--      Sunday 11:00 weekly check-in. Each is skipped if already logged.
--    Replace YOUR_CRON_SECRET (your CRON_SECRET from Vercel), then run this block.
--    To stop: select cron.unschedule('notora-reminders');
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('notora-reminders', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://notora-ai.vercel.app/api/notify/tick',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
