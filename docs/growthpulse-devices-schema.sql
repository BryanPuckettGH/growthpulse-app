-- GrowthPulse cloud device ownership
-- Run this in the Supabase SQL Editor (SQL Editor -> New query -> paste -> Run).
--
-- Claims move from the browser into the account: sign in anywhere and your
-- plants follow. claim_code is UNIQUE, so a unit can only ever have one owner
-- at a time; removing the device in the app releases it.

create table if not exists devices (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  claim_code         text not null unique,
  losant_device_id   text not null,
  name               text not null default 'My Plant',
  location           text default '',
  geo                jsonb,
  grp                text,
  transport          text not null default 'wifi',
  plant              text not null default 'generic',
  irrigation         jsonb,
  created_at         timestamptz default now()
);

alter table devices enable row level security;

-- Each user can see and manage only their own devices.
drop policy if exists "own devices select" on devices;
create policy "own devices select" on devices for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own devices insert" on devices;
create policy "own devices insert" on devices for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own devices update" on devices;
create policy "own devices update" on devices for update to authenticated using (auth.uid() = user_id);

drop policy if exists "own devices delete" on devices;
create policy "own devices delete" on devices for delete to authenticated using (auth.uid() = user_id);
