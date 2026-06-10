# GrowthPulse Gateway Auto-Register

When a customer adds or scans a LoRaWAN gateway in the app, the app calls the
`register-gateway` Netlify function, which creates that gateway on **your** The
Things Stack network and ties it to their account. The customer never logs into
The Things Stack.

## What it does and does NOT do

- **Does:** registers the gateway *entity* on TTS (EUI, ID, US915 FSB2 plan) under
  your account, so its uplinks are accepted by your network. Idempotent: re-adding
  an already-registered gateway is treated as success.
- **Does NOT:** configure the gateway *hardware*. A gateway must already be set to
  forward to your TTS server (Packet Forwarder -> `nam1.cloud.thethings.network`
  :1700, US915 FSB2). The app can't reach inside the gateway, so bake that into the
  gateway image **before shipping** (one-time per gateway, or part of your
  production gateway flash).

## One-time setup (Netlify env vars)

Create a TTS API key first: TTS Console -> **User settings -> API keys -> Add API
key**, grant it the gateway rights (create/read gateways). Copy the key.

Then add these in Netlify -> Site configuration -> Environment variables:

| Key | Value |
|---|---|
| `TTS_API_KEY` | the TTS API key you just created |
| `TTS_USER_ID` | your TTS account (or org) username that owns the gateways |
| `TTS_CLUSTER` | `nam1.cloud.thethings.network` (default if unset) |
| `TTS_FREQ_PLAN` | `US_902_928_FSB_2` (default if unset) |

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are already set (used to verify
the signed-in user). Redeploy after adding the vars.

## Flow

1. Customer scans/adds a gateway in the app (Devices -> Add gateway).
2. App saves it to their Supabase `gateways` row (follows their account).
3. App POSTs `{ eui, name }` + their session token to `register-gateway`.
4. The function validates the session and creates the gateway on TTS via
   `POST /api/v3/users/{TTS_USER_ID}/gateways`.
5. Once the gateway hardware (pre-pointed at your TTS server) powers on, it shows
   as Connected, and any GrowthPulse node in range can join through it.
