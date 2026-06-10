# GrowthPulse LoRaWAN Auto-Provisioning

The LoRaWAN twin of the Wi-Fi self-provisioning. Switching a device to LoRaWAN in
the app now sets the board up automatically, no TTS console, no hand-pasted keys.

## What happens when you switch a board to LoRaWAN

1. App calls `provision-lorawan` with the board's Losant device id + your session.
2. The function generates fresh OTAA keys (DevEUI + AppKey; JoinEUI = zeros).
3. It creates a unique end-device on The Things Stack via the 4-call API
   (Identity -> Join -> Network -> Application server), US915 FSB2, MAC 1.0.4, OTAA.
4. It stores the route (TTS device -> the board's **existing** Losant device) in the
   Supabase `lorawan_devices` table, so the uplink webhook routes dynamically.
5. It pushes the keys to the board via a Losant `provisionLoRa` command. The board
   (online over Wi-Fi, running v4+ combined firmware) saves them to flash and reboots
   into LoRaWAN, then joins any gateway in range.
6. Uplinks land on the **same** Losant device the board used over Wi-Fi, so it's one
   plant in the app that simply changed transport.

Switching back to Wi-Fi: hold the board's PRG button 3s (recovers to Wi-Fi setup),
or send a downlink (fPort 11, byte `00`).

## One-time setup

### 1. Run the route-table migration
Supabase -> SQL Editor -> New query -> paste `docs/growthpulse-lorawan-routes-schema.sql` -> Run.

### 2. Create a TTS API key with the right grants
TTS Console -> **User settings -> API keys -> Add API key**. Grant it rights to
**create/read/write end devices** (for auto-provisioning) and, if you also use the
gateway auto-register, **create/read gateways**. Copy the key.

### 3. Netlify env vars
Add (Site configuration -> Environment variables), then redeploy:

| Key | Value |
|---|---|
| `TTS_API_KEY` | the TTS API key from step 2 |
| `TTS_APP_ID` | your TTS application id (e.g. `growthpulse`) |
| `TTS_USER_ID` | your TTS username (for the gateway auto-register) |
| `TTS_CLUSTER` | `nam1.cloud.thethings.network` (default if unset) |
| `TTS_FREQ_PLAN` | `US_902_928_FSB_2` (default if unset) |

`LOSANT_APP_ID`, `LOSANT_COMMAND_TOKEN`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are already set.

## Requirements / limits
- The board must run **v4+ combined firmware** (`GP_Combined`) and be **online over
  Wi-Fi** when you switch it (so it can receive the keys; otherwise the command
  queues until it next connects).
- Each switch creates a **new** TTS device with its own keys, so two boards never
  share a DevEUI. This is what makes a teammate's board flash-and-go on LoRaWAN.
- The board still needs a gateway in range on your network (FSB2). Gateways are
  registered via the gateway auto-register flow.
