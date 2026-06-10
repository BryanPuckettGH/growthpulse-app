-- GrowthPulse cloud gateways
-- Run this in the Supabase SQL Editor (SQL Editor -> New query -> paste -> Run).
--
-- Moves LoRaWAN gateways from the browser into the account, so a gateway you add
-- follows you to any device and survives logout (same model as devices). Each
-- gateway is identified by its EUI (the 16-hex ID on the label).

create table if not exists gateways (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null default 'My Gateway',
  eui         text not null,
  created_at  timestamptz default now()
);

alter table gateways enable row level security;

-- Each user can see and manage only their own gateways.
drop policy if exists "own gateways select" on gateways;
create policy "own gateways select" on gateways for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own gateways insert" on gateways;
create policy "own gateways insert" on gateways for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own gateways update" on gateways;
create policy "own gateways update" on gateways for update to authenticated using (auth.uid() = user_id);

drop policy if exists "own gateways delete" on gateways;
create policy "own gateways delete" on gateways for delete to authenticated using (auth.uid() = user_id);
