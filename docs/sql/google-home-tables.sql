-- Google Home account linking + valve state mirror.
-- Run once in the Supabase SQL editor.
--
-- All three tables are server-side only: RLS is enabled with NO policies, so
-- the anon/browser key can never read them. The Netlify functions use the
-- service-role key, which bypasses RLS.

create table if not exists public.google_oauth_codes (
  code         text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  expires_at   timestamptz not null,
  used         boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.google_oauth_codes enable row level security;

create table if not exists public.google_oauth_tokens (
  refresh_token text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.google_oauth_tokens enable row level security;

-- One row per GrowthPulse device: when the valve is expected to close.
create table if not exists public.google_valve_runs (
  device_id  uuid primary key references public.devices(id) on delete cascade,
  until_ts   timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.google_valve_runs enable row level security;
