-- Fitbit workouts (exercise sessions) per day for the Logs page. Safe to run more than once.
alter table notora.health_daily add column if not exists workouts jsonb;
