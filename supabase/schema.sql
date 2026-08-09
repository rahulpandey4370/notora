-- Run this once in the Supabase SQL Editor to create Notora's tables.
--
-- Notora shares a Supabase project with an unrelated app (ai-expense-tracker).
-- Everything here lives in its own Postgres schema ("notora"), so table names
-- can never collide with the other app's tables (which live in "public"), and
-- neither app's code can accidentally touch the other's data.
--
-- After running this, go to Project Settings -> API -> Exposed schemas and
-- add "notora" to the list (only "public" is exposed by default) so
-- @supabase/supabase-js can query it.

create schema if not exists notora;

-- The whole app persists a single JSON document per user (see src/lib/types.ts
-- AppData: tasks, noteBoards, userStats, savedLinks, logTrackers,
-- journalEntries, taskTemplates, taskTemplateBundles). There are zero
-- per-field queries anywhere in the app today -- every read/write is
-- whole-document -- so a JSONB blob-per-user column mirrors current behavior
-- exactly with no risk of mangling nested structures (e.g. sticky-note
-- undo/redo history) during a relational redesign nobody asked for.
create table if not exists notora.app_data (
  username text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Replaces the users.json blob (login / change-password routes). One row per
-- account; lazily seeded from src/lib/users.ts defaults on first login if
-- empty, matching the current Azure Blob "create with defaults if missing"
-- behavior.
create table if not exists notora.users (
  username text primary key,
  email text not null unique,
  password_hash text not null,
  avatar_url text not null
);

-- Creating a schema manually (unlike Supabase's built-in "public") does not
-- grant the API roles any access to it -- without this, PostgREST returns
-- "permission denied for schema notora" even after exposing the schema above.
grant usage on schema notora to anon, authenticated, service_role;
grant all on all tables in schema notora to anon, authenticated, service_role;
grant all on all sequences in schema notora to anon, authenticated, service_role;
alter default privileges in schema notora grant all on tables to anon, authenticated, service_role;
alter default privileges in schema notora grant all on sequences to anon, authenticated, service_role;
