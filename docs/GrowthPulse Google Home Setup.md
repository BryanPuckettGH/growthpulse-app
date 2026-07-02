# GrowthPulse Google Home Setup

How the "Hey Google" integration works and how to finish deploying it.
Console project: **growthpulse-0da7b** (console.home.google.com, puckettonline@gmail.com).

## Architecture

```
Google Assistant / Home app
        |  OAuth account linking          |  smart home intents
        v                                 v
/oauth/authorize  /oauth/token      /api/google-home
(oauth-authorize.js) (oauth-token.js)  (google-home.js)   <- Netlify functions
        |                                 |
     Supabase (auth + devices + token tables)
                                          |
                                     Losant (state + setValve command)
                                          |
                                     GP node (valve watchdog closes after N sec)
```

Each GrowthPulse node shows up in Google Home as two devices:

- **Sensor** (`<device>:sensor`): soil temperature ("what's the temperature of Outdoor Plant?") and soil moisture, exposed as humidity ("what's the humidity of Outdoor Plant?").
- **Sprinkler** (`<device>:valve`, named "<name> water"): "turn on Outdoor Plant water", "run Outdoor Plant water for 10 seconds". Default run 60s, cap 10 min, firmware auto-closes.

## One-time deploy steps

1. **Supabase**: run `docs/sql/google-home-tables.sql` in the SQL editor (creates `google_oauth_codes`, `google_oauth_tokens`, `google_valve_runs`, all service-role only).

2. **Netlify env vars** (Site settings > Environment variables). Values are in the local `.env`:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GH_JWT_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY` - copy from Supabase dashboard (Settings > API > service_role). Never expose this to the browser.

3. **Deploy** the site (the new functions + `netlify.toml` redirects go live).

4. **Flash** the updated `GP_Final` firmware (adds `durationSeconds` to `setValve`).

5. **Link in the Google Home app** (same Google account as the console): Devices > Add > Works with Google > search **[test] GrowthPulse** > sign in with your GrowthPulse account.

## Try it

- "Hey Google, what's the temperature of <plant name>?"
- "Hey Google, what's the humidity of <plant name>?"
- "Hey Google, run <plant name> water for 10 seconds."
- "Hey Google, turn off <plant name> water."

## Notes and limits

- **Test mode**: the integration is visible only to the console account (and testers added there). Public listing requires Google certification.
- **Report State is not implemented yet** (`willReportState: false`). Voice queries hit our QUERY intent live, but Home app tiles may lag. Adding Report State + `requestSync` on device claim/removal is the next enhancement (HomeGraph API + service account).
- **Soil moisture = "humidity"**: Google has no soil-moisture trait, so it rides on HumiditySetting.
- **LoRaWAN nodes**: `setValve` is a downlink; a Class A node only receives it right after an uplink, so voice valve control is only snappy on Wi-Fi transport.
- **Device names**: renaming a plant in the GrowthPulse app updates Google on the next SYNC (unlink/relink, or say "Hey Google, sync my devices").
- If account linking fails with "invalid session", check that `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are present in the Netlify env.
