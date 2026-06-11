# GrowthPulse LoRaWAN Cleanup and Reset

Do this once to clear the orphan devices and move to the new "one TTS device per
board" design. After this, switching a board between Wi-Fi and LoRaWAN reuses a
single stable device, so the Wi-Fi switch-back downlink lands correctly and the
app card tracks the real link.

## 1. Reset the route table (Supabase)

SQL Editor -> New query -> paste `docs/growthpulse-lorawan-routes-schema-v2.sql`
-> Run. This adds the `app_key` column, clears the orphan v1 rows, and makes the
board id unique (one device per board).

## 2. Delete the orphan TTS devices (optional but tidy)

In the TTS Console -> your `growthpulse` application -> End devices, delete the
`gp-...` devices that show "Never" activity (they were throwaway). You can keep
`growthpulse-node-01`. Re-provisioning will rebuild exactly one `gp-...` device.

## 3. Confirm the uplink webhook exists

Still in the `growthpulse` application -> Integrations -> Webhooks. There should
be one webhook with:
- Base URL `https://growthpulsecloud.com/.netlify/functions/lorawan-uplink`
- "Uplink message" enabled
- An `X-Webhook-Token` header whose value equals the Netlify `LORAWAN_WEBHOOK_TOKEN`

If it's missing, that alone explains a card stuck on Wi-Fi (no uplink ever reaches
the app). Add it and the card will start tracking LoRaWAN.

## 4. Deploy + re-provision

1. Commit and push the app, then redeploy on Netlify (Deploys -> Trigger deploy).
2. In the app, open the board and switch it to **LoRaWAN**. This creates one clean
   device, stores the route (with its AppKey), and pushes the keys to the board.
3. The board joins; within a check-in the card should read "LoRaWAN" with live RSSI.
4. Switch it back to **Wi-Fi**. The downlink now targets that same device, so the
   node receives the `0x00`, reboots, and reconnects over Wi-Fi.

From now on, flipping the same board between transports reuses the one device, so
no orphans and no `no_device_session`.
