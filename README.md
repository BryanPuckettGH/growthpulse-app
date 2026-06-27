# GrowthPulse Web App

The cloud application for **GrowthPulse**, a smart plant monitoring product: an ESP32 sensor node a customer plugs in and pairs from their phone, streaming live soil and air readings to a multi-tenant web app with real accounts, smart alerts, plant profiles, and subscription tiers. Nodes connect over **Wi-Fi** at home or over **LoRaWAN** for fields and far gardens, and a node can be switched between the two entirely from the app.

**Live:** https://growthpulsecloud.com

Built with React 18 + Vite, Supabase (auth + registry + routing), Losant (device cloud), The Things Stack (LoRaWAN network server), and Netlify (hosting + serverless functions). Installable to a phone home screen as a PWA.

---

## How the product works

```
Wi-Fi node    -> MQTT --------------------------> Losant device cloud
                                                        |
LoRaWAN node  -> gateway -> The Things Stack -> webhook -> Netlify -> Losant
                                                        |
                                  Netlify function (tokens server-side)
                                                        |
                                          React app (this repo) -> customer
```

Both transports write to the **same Losant device**, so a node is one plant in the app no matter how it is connected. The app only ever reads Losant.

1. The customer powers the unit. A Wi-Fi unit opens a **branded captive portal** (`GrowthPulse-XXXXXX`) where they pick their home Wi-Fi. No app or account needed for this step.
2. On first boot the unit **self-provisions**: it derives a **pairing code** from its chip hardware id and posts it (with a shared firmware token) to `provision-device`, which creates or reuses its own Losant device and returns a device-scoped key. One image, no per-board secrets.
3. In this app, the customer creates an account and claims the device with the code shown on its screen. Codes are validated against a `device_registry` table in Supabase, unknown codes are rejected.
4. The app polls a serverless function for live readings; the function holds the cloud API token so **no credential ever reaches the browser**.
5. **LoRaWAN** is automated end to end: adding a gateway registers it on the network for the customer, and switching a node to LoRaWAN mints (or reuses) its network identity and pushes keys to the board, which reboots and joins. Switching back to Wi-Fi sends a downlink the node applies on its next check-in. The customer never touches a network console.
6. Factory reset from the app sends a cloud command that makes the unit wipe its own Wi-Fi and reboot into setup mode, ready for resale.

## Feature highlights

- **Real accounts** (Supabase) with per-account data isolation, plus a no-signup **demo mode** for prospects
- **Claim-by-code pairing** with registry validation
- **Live dashboard**: status-colored readings, soil gauge, 0-100 plant health score, trends, tap-through metric detail
- **Plant profiles**: species-specific ideal ranges drive colors, score, and advice
- **Honest hardware states**: disconnected probes show "not connected" (detected via each sensor's physical failure signature) with fix-it hints; claimed devices show "waiting" until real data arrives, never fake numbers
- **Per-plant weather**: each device stores a geocoded home location, so forecasts and rain alerts follow the plant, not the owner's phone
- **Alarms** with toasts in-app and email/SMS via cloud workflows
- **Device management**: rename, group, home location, connection type (Wi-Fi / LoRaWAN gateway), delete with purge, and **factory reset for resale** with remote Wi-Fi wipe
- **Real LoRaWAN, automated**: add and auto-register a gateway, switch a node to LoRaWAN (the backend mints its network identity and pushes keys), and switch it back, all from the app; the card shows the true link with live RSSI and SNR
- **Power awareness**: AC/battery badges, charging state, low-battery warnings, soft power-off (double-tap to sleep)
- **Shareable plant report**: branded printable report (save as PDF) with readings, stats, weather, and journal photos
- **Growth journal** with photos, **History** charts with ideal bands, °F/°C, dark mode, responsive desktop sidebar layout
- **PWA**: Add to Home Screen with real icons, full-screen mode, safe-area support

## Documentation (in `docs/`)

The documentation is a four-manual controlled set (June 2026 edition, with embedded wiring and architecture diagrams):

| Document | What it covers |
|----------|----------------|
| [Engineering Manual (PDF)](docs/GrowthPulse%20Engineering%20Manual.pdf) | The development record: full architecture, every design decision and why, the complete 24-issue debugging journal, decision log, and roadmap |
| [Technical Reference Manual (PDF)](docs/GrowthPulse%20Technical%20Reference%20Manual.pdf) | The current-state spec: GPIO map, firmware constants and NVS keys, telemetry/payload/command specs, all nine function APIs, database schemas, TTS and Losant reference, app constants, plant ranges |
| [Operations Manual (PDF)](docs/GrowthPulse%20Operations%20Manual.pdf) | Procedures and runbooks: toolchain setup, flashing, wiring and calibration, deploys, gateway bring-up, console operations, recovery runbooks, and the full troubleshooting catalog |
| [User Manual (PDF)](docs/GrowthPulse%20User%20Manual.pdf) | Customer-facing: setup, Wi-Fi pairing, LoRaWAN, the button, every app feature, troubleshooting, FAQ, specs |

Supporting documents:

| Document | What it covers |
|----------|----------------|
| [LoRaWAN System and Debugging Report](docs/GrowthPulse%20LoRaWAN%20System%20and%20Debugging%20Report.md) | The chronological LoRaWAN bring-up journal (the Engineering Manual carries the consolidated record) |
| [LoRaWAN Bring-Up Guide (PDF)](docs/GrowthPulse%20LoRaWAN%20Bring-Up%20Guide.pdf) | Sourced external reference for gateway and The Things Stack setup (procedures now consolidated in the Operations Manual) |
| [Product Roadmap (PDF)](docs/GrowthPulse%20Product%20Roadmap.pdf) + [Deployment Model (PDF)](docs/GrowthPulse%20Deployment%20Model.pdf) | Product strategy |
| Supabase schemas | `growthpulse-supabase-schema.sql` (registry), `growthpulse-devices-schema.sql` (ownership), `growthpulse-lorawan-routes-schema-v2.sql` (LoRaWAN routing), `growthpulse-gateways-schema.sql` (gateways) |

The older standalone guides (Wiring Guide, Teammate and Web App Checklists, Auto-Provision and Gateway Auto-Register setups, Cleanup and Reset) are superseded by the Operations Manual and remain in `docs/` for history. Diagram sources live in `docs/assets/`.

Markdown versions of the manuals sit next to the PDFs so they stay editable.
Version history for the app and firmware: [CHANGELOG.md](CHANGELOG.md).

## Firmware (in `firmware/`)

`firmware/GP_Combined/GP_Combined.ino` (v4.3) is the **production image** for the Heltec WiFi LoRa 32 V3. One identical image runs either Wi-Fi or LoRaWAN, chosen by a saved flag in flash (NVS), with **no per-board secrets**:

- **Wi-Fi**: branded captive-portal setup, self-provisioning, MQTT telemetry to Losant.
- **LoRaWAN**: load OTAA keys from flash, join any gateway, uplink a 9-byte payload.
- Shared: rotating OLED (pairing code, connection, readings), tiered PRG button (tap to wake, double-tap to sleep, 3s to return to Wi-Fi, 10s to factory reset), battery and charging, remote factory reset.

Reference images also live in `firmware/`: `GP_Node` (Wi-Fi-only self-provisioning), `GP_LoRaWAN` (the standalone OTAA reference), and `GP_Provisioning` (the original captive-portal firmware).

To run the combined image on your own board:

1. Follow chapter 2 of the Operations Manual: Arduino IDE, the CP210x USB driver, the ESP32 board package, board "Heltec WiFi LoRa 32(V3)", and the listed libraries (including RadioLib for the SX1262).
2. Set **Tools > Partition Scheme** to a larger-app / "Huge App" layout (the combined image is large).
3. Replace the placeholder `PROVISION_TOKEN` with your real shared firmware token (and set the same value as the Netlify `PROVISION_TOKEN`). Never commit the real value.
4. Wire sensors per the Operations Manual's wiring diagram and bench procedure, flash, and pair using the code on the OLED.

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
SUPABASE_SERVICE_ROLE_KEY=...service role (registry/routing writes, bypasses RLS)...
LOSANT_API_TOKEN=...read-only application token...
LOSANT_APP_ID=...application id...
LOSANT_COMMAND_TOKEN=...write-capable token for device state + commands...
LOSANT_PROVISION_API_TOKEN=...token with device-create rights (self-provision)...
PROVISION_TOKEN=...shared firmware token (matches the value in the image)...
# LoRaWAN (The Things Stack):
TTS_API_KEY=...TTS API key with device + gateway write rights...
TTS_APP_ID=...TTS application id (e.g. growthpulse)...
TTS_CLUSTER=nam1.cloud.thethings.network
TTS_IS_HOST=eu1.cloud.thethings.network
TTS_USER_ID=...TTS account that owns registered gateways...
TTS_FREQ_PLAN=US_902_928_FSB_2
LORAWAN_WEBHOOK_TOKEN=...shared secret the TTS uplink webhook sends...
```

The Identity Server host (`TTS_IS_HOST`, eu1) and the operating cluster (`TTS_CLUSTER`, nam1) are deliberately different: on The Things Network, device and gateway registration is centralized on eu1 while the network/join/application servers run on the regional cluster. See Engineering Manual section 14.5.

Notes:
- `VITE_`-prefixed vars are baked into the client bundle. Everything else is server-side only.
- The serverless functions do not run under `vite dev`, so claimed devices show "waiting" locally. Use `netlify dev` or the deployed site to see live device data.

## Deployment

Pushing to `main` auto-deploys via Netlify (`netlify.toml`: build `npm run build`, publish `dist/`, functions in `netlify/functions/` with esbuild). Set the environment variables above in Netlify site configuration, marking every token and key as secret. Note that Netlify environment changes only take effect on a redeploy: after editing a variable, trigger a deploy.

## Project structure

```
index.html                 PWA meta, manifest, icons
public/                    brand SVGs, manifest.webmanifest, app icons
netlify/functions/
  device-state.js          GET live reading (transport + signal aware)
  device-command.js        POST owner-verified command (factory reset, etc.)
  device-history.js        time-series history for report graphs
  provision-device.js      Wi-Fi self-provision: create/reuse Losant device + key
  provision-lorawan.js     idempotent LoRaWAN provisioning (one TTS device/board)
  lorawan-uplink.js        TTS uplink webhook: decode bytes, route to Losant
  lorawan-switch-wifi.js   enqueue the 0x00 downlink to return a node to Wi-Fi
  register-gateway.js      auto-register a customer gateway on TTS
  render-pdf.js            headless-Chrome vector PDF renderer
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

- **Supabase**: auth, `device_registry` (pairing code -> Losant device id), `devices` (ownership, per-user RLS), `lorawan_devices` (TTS device -> Losant device routing, service-role only), and `gateways`. Schemas in `docs/`.
- **Losant**: device, access keys (device MQTT) and API tokens (REST), email/SMS alert workflows. The single source of truth the app reads, for both transports.
- **The Things Stack** (The Things Network sandbox): the LoRaWAN network server. Identity Server on eu1 (device/gateway registration), network/join/application servers on nam1. Forwards uplinks to the `lorawan-uplink` webhook.
- **Netlify**: hosting, build pipeline, and the environment variables that hold all live tokens.

## Security model

- Cloud tokens live only in Netlify function env vars, never in the bundle.
- Supabase anon key is public by design; row-level security gates all table access.
- Registry rejects unknown pairing codes; the command function allowlists command names.
- The committed firmware carries no device credentials and only a placeholder provisioning token; real device keys are minted per board at first boot by `provision-device` and live only in the board's flash. Real tokens and `.env` values never enter git.
- LoRaWAN routing and the AppKeys live in the service-role-only `lorawan_devices` table; the browser cannot read them. TTS, Losant, and Supabase service tokens live only in Netlify env vars.

---

GrowthPulse · Smart Plant Monitoring · FIU Senior Design
