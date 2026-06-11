-- GrowthPulse LoRaWAN routes - v2 (idempotent, one device per board)
-- Run this in the Supabase SQL Editor (SQL Editor -> New query -> paste -> Run).
--
-- v1 stored a row per TTS device, and provisioning minted a NEW DevEUI on every
-- Wi-Fi->LoRaWAN switch, so a single board accumulated many TTS devices (orphans)
-- and downlinks could be aimed at a device the node never joined. v2 makes the
-- mapping one row per board: the board's Losant id is unique, and we store the
-- AppKey so the same identity can be re-pushed on later switches instead of
-- creating a new device.
--
-- Safe to run on a fresh project (the v1 table may or may not exist).

create table if not exists lorawan_devices (
  tts_device_id     text primary key,
  dev_eui           text not null,
  app_key           text,                      -- OTAA root key, re-pushed on reuse
  losant_device_id  text not null,
  user_id           uuid references auth.users(id) on delete cascade,
  created_at        timestamptz default now()
);

-- Add the AppKey column if upgrading an existing v1 table.
alter table lorawan_devices add column if not exists app_key text;

-- Clear orphaned v1 rows so the new unique constraint adds cleanly. (These only
-- mapped throwaway TTS devices; re-provisioning rebuilds the real one.)
truncate table lorawan_devices;

-- One TTS device per board: the board's Losant id must be unique.
create unique index if not exists lorawan_devices_losant_uidx
  on lorawan_devices (losant_device_id);

alter table lorawan_devices enable row level security;
-- RLS on with no policies = clients can't read/write it; the service role (used
-- by the serverless functions) bypasses RLS, which is exactly what we want.
