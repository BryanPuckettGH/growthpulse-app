-- GrowthPulse device registry
-- Run this in the Supabase SQL Editor (Database -> SQL Editor -> New query -> Run).
--
-- The registry maps each unit's short claim code (printed on the box) to its
-- cloud device id. In production, one row is added per manufactured unit.

create table if not exists device_registry (
  claim_code         text primary key,
  losant_device_id   text not null,
  created_at         timestamptz default now()
);

-- Signed-in users may look up a claim code to connect a device, but cannot edit the registry.
alter table device_registry enable row level security;

drop policy if exists "authenticated can read registry" on device_registry;
create policy "authenticated can read registry"
  on device_registry for select
  to authenticated
  using (true);

-- Seed your one demo unit: chip claim code 4A7AC -> the Greenhouse Node device.
insert into device_registry (claim_code, losant_device_id)
values ('4A7AC', '6a1fb486df527c8bf8d3324b')
on conflict (claim_code) do nothing;
