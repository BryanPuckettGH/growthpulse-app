# GrowthPulse LoRaWAN Setup — Web App Checklist (Bryan)

Your job: get the LoRaWAN code deployed and wire the webhook into the app, so a node your teammate brings up in The Things Stack shows up in the app like any Wi-Fi node. Your teammate handles the gateway, The Things Stack, and the node join (separate checklist); you handle GitHub + Netlify.

**Two things you need from your teammate** (this is how the two halves connect):
1. Their TTS **device ID** (from step 4 of their checklist).
2. The agreed **webhook secret token** (any long random string you both use).

---

## 1. Protect main, work on a branch

```
cd "Senior Design 2/growthpulse-app"
git tag -a v2.12.2 -m "Stable before LoRaWAN" && git push --tags
git checkout -b lorawan-bringup
```
Now `main` is tagged and safe; if anything goes sideways, `git checkout v2.12.2`.

## 2. Commit + push the LoRaWAN files

These are already created in the repo:
- `netlify/functions/lorawan-uplink.js`  (the webhook that lands uplinks in the app pipeline)
- `firmware/GP_LoRaWAN/GP_LoRaWAN.ino`  (the node firmware your teammate flashes)
- `docs/GrowthPulse LoRaWAN Bring-Up Guide.(md/pdf)` and both checklists

```
git add . && git commit -m "LoRaWAN bring-up: webhook, bench firmware, guide" && git push -u origin lorawan-bringup
```

The webhook function goes live when this is deployed. You can deploy the branch as a Netlify deploy preview, or merge to `main` when you're ready for it on the live site. (Netlify auto-builds on push.)

## 3. Set the Netlify environment variables

Netlify → your site → **Site configuration → Environment variables**. Add:

| Variable | Value |
|---|---|
| `LORAWAN_WEBHOOK_TOKEN` | the **secret token** you agreed with your teammate (must match the TTS webhook header exactly) |
| `LORAWAN_DEVICE_MAP` | JSON mapping their TTS device ID to a Losant device id, e.g. `{"their-device-id":"6a1fb486df527c8bf8d3324b"}` |

Already set from before (confirm they exist): `LOSANT_APP_ID`, `LOSANT_COMMAND_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

> `6a1fb486df527c8bf8d3324b` is your existing node's Losant device id. Use a different Losant device id if you want the LoRaWAN node to be a separate plant in the app. (If you'd rather not keep a map, you can instead set `LORAWAN_DEFAULT_DEVICE_ID` to a single Losant device id and skip `LORAWAN_DEVICE_MAP`.)

Trigger a redeploy after adding env vars (Netlify → Deploys → Trigger deploy) so the function picks them up.

## 4. Verify it end to end

Once your teammate's node is joined and uplinking, and your function is deployed with the env vars:
1. Netlify → **Functions → lorawan-uplink → logs**: you should see `forwarded: true` each time an uplink arrives (~every 60s in test).
2. Open the app → the mapped device should show live readings, and the connection badge should read **LoRaWAN** (the app shows the real link from the node's data).
3. If logs show `401 Bad webhook token` → the token in Netlify and the TTS webhook header don't match. `404 No Losant mapping` → the device id in `LORAWAN_DEVICE_MAP` doesn't match their TTS device ID.

## 5. When it works

Merge the branch to `main`:
```
git checkout main && git merge lorawan-bringup && git push
```
If you ever need to back out: `git checkout v2.12.2` returns you to the pre-LoRaWAN state.

---

**You're done when:** the Netlify function logs show forwarded uplinks and the LoRaWAN node appears live in the app. The next build step (merging LoRaWAN into the main firmware as a boot-selectable mode) happens after the join is proven, see Bring-Up Guide §8.
