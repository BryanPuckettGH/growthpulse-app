# GrowthPulse Web App

The cloud application for **GrowthPulse**, a smart plant monitoring product: an ESP32 sensor node a customer plugs in and pairs from their phone, streaming live soil and air readings to a multi-tenant web app with real accounts, smart alerts, plant profiles, and subscription tiers.

**Live:** https://growthpulsecloud.com

Built with React 18 + Vite, Supabase (auth + device registry), Losant (device cloud), and Netlify (hosting + serverless functions). Installable to a phone home screen as a PWA.

---

## How the product works

```
Sensors -> ESP32 firmware -> MQTT -> Losant device cloud
                                        |
                          Netlify function (token server-side)
                                        |
                            React app (this repo) -> customer
```

1. The customer powers the unit. It opens a **branded captive portal** (`GrowthPulse-XXXXXX`) where they pick their home Wi-Fi. No app or account needed for this step.
2. The unit's screen then shows a short **pairing code** (derived from the chip's factory MAC).
3. In this app, the customer creates an account and claims the device with that code. Codes are validated against a `device_registry` table in Supabase, unknown codes are rejected.
4. The app polls a serverless function for live readings; the function holds the cloud API token so **no credential ever reaches the browser**.
5. Factory reset from the app sends a cloud command that makes the unit wipe its own Wi-Fi and reboot into setup mode, ready for resale.

## Feature highlights

- **Real accounts** (Supabase) with per-account data isolation, plus a no-signup **demo mode** for prospects
- **Claim-by-code pairing** with registry validation
- **Live dashboard**: status-colored readings, soil gauge, 0-100 plant health score, trends, tap-through metric detail
- **Plant profiles**: species-specific ideal ranges drive colors, score, and advice
- **Honest hardware states**: disconnected probes show "not connected" (detected via each sensor's physical failure signature) with fix-it hints; claimed devices show "waiting" until real data arrives, never fake numbers
- **Per-plant weather**: each device stores a geocoded home location, so forecasts and rain alerts follow the plant, not the owner's phone
- **Alarms** with toasts in-app and email/SMS via cloud workflows
- **Device management**: rename, group, home location, connection type (Wi-Fi / LoRaWAN gateway), delete with purge, and **factory reset for resale** with remote Wi-Fi wipe
- **LoRaWAN gateways** section for the Farm Kit story
- **Power awareness**: AC/battery badges, charging state, low-battery warnings (firmware-ready)
- **Shareable plant report**: branded printable report (save as PDF) with readings, stats, weather, and journal photos
- **Growth journal** with photos, **History** charts with ideal bands, °F/°C, dark mode, responsive desktop sidebar layout
- **PWA**: Add to Home Screen with real icons, full-screen mode, safe-area support

## Documentation (in `docs/`)

| Document | What it covers |
|----------|----------------|
| [User Manual (PDF)](docs/GrowthPulse%20User%20Manual.pdf) | Customer-facing: setup, Wi-Fi pairing, every app feature, troubleshooting, FAQ, specs |
| [Engineering Manual (PDF)](docs/GrowthPulse%20Engineering%20Manual.pdf) | Deep dive: hardware, firmware section by section, cloud, backend, app architecture, decision log, debugging runbook |
| [Wiring Guide (PDF)](docs/GrowthPulse%20Wiring%20Guide.pdf) + [Wiring Diagram (PDF)](docs/GrowthPulse%20Wiring%20Diagram.pdf) | Bench wiring, pin by pin, with the pull-up explained |
| [Product Roadmap (PDF)](docs/GrowthPulse%20Product%20Roadmap.pdf) + [Deployment Model (PDF)](docs/GrowthPulse%20Deployment%20Model.pdf) | Product strategy |
| [Supabase schema](docs/growthpulse-supabase-schema.sql) | The `device_registry` table and its row-level security |

Markdown versions of both manuals sit next to the PDFs so they stay editable.

## Firmware (in `firmware/`)

`firmware/GP_Provisioning/GP_Provisioning.ino` is the complete node firmware for the Heltec WiFi LoRa 32 V3: branded captive-portal Wi-Fi setup, OLED pairing code, PRG hold-to-reset, remote factory-reset command, and sensor telemetry.

To run it on your own board:

1. Follow chapter 2 of the Engineering Manual: Arduino IDE, the Silicon Labs CP210x USB driver, the ESP32 board package, board "Heltec WiFi LoRa 32(V3)", and the seven listed libraries.
2. Create your own device + access key in [Losant](https://www.losant.com) and replace the three `YOUR-LOSANT-...` placeholder constants. Never commit real values.
3. Wire sensors per the Wiring Guide, flash, and pair using the code on the OLED.

`firmware/diagnostics/` holds two bench sketches used during bring-up: an ADC scanner and a 1-Wire scanner.

## Local development

Requires Node.js (LTS).

```bash
npm install
npm run dev        # http://localhost:5173
```

Create `.env` in the project root (gitignored):

```
VITE_SUPABASE_URL=...your Supabase project URL...
VITE_SUPABASE_ANON_KEY=...anon key...
# Server-side only (used by functions; set in Netlify for production):
LOSANT_API_TOKEN=...read-only application token...
LOSANT_APP_ID=...application id...
LOSANT_COMMAND_TOKEN=...write-capable token for device commands...
```

Notes:
- `VITE_`-prefixed vars are baked into the client bundle. Everything else is server-side only.
- The serverless functions do not run under `vite dev`, so claimed devices show "waiting" locally. Use `netlify dev` or the deployed site to see live device data.

## Deployment

Pushing to `main` auto-deploys via Netlify (`netlify.toml`: build `npm run build`, publish `dist/`, functions in `netlify/functions/` with esbuild). Set the five environment variables above in Netlify site configuration, mark the two tokens as secret.

## Project structure

```
index.html                 PWA meta, manifest, icons
public/                    brand SVGs, manifest.webmanifest, app icons
netlify/functions/
  device-state.js          GET live reading for a device (read-only token)
  device-command.js        POST factoryReset command (write token, allowlisted)
src/
  App.jsx                  auth gate, shell, tabs, toasts, theme, report button
  auth/AuthProvider.jsx    Supabase session, signup metadata, demo mode
  store/
    AppContext.jsx         the store: devices, live polling loop, weather,
                           alarms, settings, tiers, journals, gateways
    helpers.js             metrics, plant ranges, health score, recommendations,
                           disconnected-sensor detection, power model
    tiers.js               subscription tiers and feature gates
  components/              Login, Onboarding, Claim/Gateway/Plans sheets,
                           WeatherCard, GrowthJournal, IrrigationCard, UI kit
  views/                   Live, History, Alarms, Devices, Settings
  utils/
    geocode.js             Open-Meteo geocoder (per-plant home location)
    report.js              branded printable plant report
```

## Related cloud services (configured outside this repo)

- **Supabase**: auth + `device_registry` (pairing code -> cloud device id, RLS read-only to authenticated users). Schema in `docs/`.
- **Losant**: device, access keys (device MQTT) and API tokens (REST), email/SMS alert workflows.
- **Netlify**: hosting, build pipeline, and the environment variables that hold all live tokens.

## Security model

- Cloud tokens live only in Netlify function env vars, never in the bundle.
- Supabase anon key is public by design; row-level security gates all table access.
- Registry rejects unknown pairing codes; the command function allowlists command names.
- The committed firmware carries placeholder credentials only; real device keys, tokens, and `.env` values never enter git. Production units get per-unit credentials (roadmap).

---

GrowthPulse · Smart Plant Monitoring · FIU Senior Design
