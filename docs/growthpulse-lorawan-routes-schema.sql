-- GrowthPulse LoRaWAN routes
-- Run this in the Supabase SQL Editor (SQL Editor -> New query -> paste -> Run).
--
-- Maps each auto-provisioned TTS end-device to the Losant device its uplinks
-- should land on (the board's existing identity), so the uplink webhook routes
-- dynamically instead of from a hand-edited env map. Written by the
-- provision-lorawan function and read by the lorawan-uplink webhook, both using
-- the service role; no client access is needed.

create table if not exists lorawan_devices (
  tts_device_id     text primary key,
  dev_eui           text not null,
  losant_device_id  text not null,
  user_id           uuid references auth.users(id) on delete cascade,
  created_at        timestamptz default now()
);

alter table lorawan_devices enable row level security;
-- RLS on with no policies = clients can't read/write it; the service role (used
-- by the serverless functions) bypasses RLS, which is exactly what we want.
