# Changelog

All notable changes to GrowthPulse, the web app and the device firmware.

---

## Web App

### v2.12.2 — June 5, 2026
- A device that's still checking in now shows "Connecting…" for up to 15 seconds instead of briefly flashing "Offline" before its first reading lands. Matches the few seconds a node needs to report after the page loads.

### v2.12.1 — June 5, 2026
- The connection badge now reflects reality without any extra setup: a real node that's reporting data shows Wi-Fi (its actual link), even if LoRaWAN was selected. The transport picker explains that LoRaWAN node firmware is still in development and the node uses Wi-Fi today.

### v2.12.0 — June 5, 2026
- First load no longer says "Offline". A claimed device that hasn't reported yet shows "Connecting…" (amber) until the first reading arrives, and the app polls immediately instead of waiting a full refresh cycle, so customers aren't scared into refreshing.
- Honest connection: the dashboard and device cards now show how a node is ACTUALLY connected (Wi-Fi, with signal) based on what the node reports, instead of a transport label you picked. Needs firmware v2.3 and a `wifiRssi` number attribute in Losant.
- Device photo: crop the picture after taking/choosing it (square, pan and zoom).

### v2.11.0 — June 5, 2026
- Device photos: add a picture to any plant/node (camera or upload). It shows on the device cards, the dashboard, and follows your account across browsers. Requires the one-line `docs/growthpulse-devices-photo.sql` migration.
- Add-a-gateway now uses the Gateway EUI (the 16-hex ID on the label's EUI line) instead of a generic code, that's the identifier a LoRaWAN network server needs. You can scan the label's QR (the app pulls the EUI out of the bundled MAC/EUI/serial payload) or type it.

### v2.10.0 — June 5, 2026
- Location is now fully optional. The app never asks for your device/GPS location and never shows a fake default city. A plant's location is only used by weather features, and you add it yourself (city or ZIP) when you want them.
- New **Rain delay** (Pro): skip automatic watering when rain is in the local forecast. Because it needs the forecast where the plant lives, turning it on asks for that plant's location and explains why; the switch names the node that still needs one.
- Weather card invites you to add a location instead of guessing one.
- Manuals: User + Engineering manuals updated for everything since the last revision (full report export, server-side PDF, cloud device ownership, location/rain delay).

### v2.9.2 — June 5, 2026
- The app no longer asks for your device location. Weather follows each plant's own home location; plants without one show a clearly-marked default city until you set it.

### v2.9.1 — June 5, 2026
- Report download now shows a clear loading screen with a spinner and step ("Gathering data…", "Rendering your PDF…") so it's obvious the work is in progress. The sheet won't close mid-render and the buttons can't be double-fired.

### v2.9.0 — June 5, 2026
- Server-side PDF rendering: the Download button now renders the report through headless Chrome in the cloud, producing a true vector PDF with crisp, selectable text.
- Automatic fallback: if the server is unavailable, slow, or the account is in demo mode, it silently falls back to the in-browser renderer — the download always works.
- The render endpoint requires a signed-in session, so it can't be abused as an open PDF service.

### v2.8.2 — June 5, 2026
- Downloaded PDFs are much sharper: higher render resolution and lossless image encoding.
- Fixed app styles leaking into the downloaded report (the logo rendered centered).
- Report stats no longer count a disconnected air sensor's zero readings (the "Min 0°F" artifact).

### v2.8.1 — June 5, 2026
- Report sheet now has two delivery buttons: "Download PDF" saves a real .pdf file directly, "Print report" opens the print dialog (paper, or sharpest save-as-PDF output).

### v2.8.0 — June 5, 2026
- Full plant report: the Settings download is now a complete PDF report with per-sensor history graphs (ideal-range shading, min/avg/max, offline gaps) and a chronological activity timeline.
- Report options: pick the time period (24h / 7 days / 30 days / everything / custom dates), which plants, and which sensors to include.
- New `device-history` cloud function pulls the full sensor history from the device cloud, so reports cover the entire time a device has been connected (auto-averaged to stay readable).
- Removed the JSON export link from Settings.

### v2.7.0 — June 5, 2026
- Cloud device ownership: claimed plants now live in the account, not the browser. Sign in anywhere and your plants follow; one-time automatic migration of existing claims.
- A pairing code can only be claimed by one account at a time.
- Factory reset is now authorized server-side: only the device's owner can send it.
- Branded PDF account export replaced the plain JSON download.
- Landing page v2: sub-pages (Features, Farm Kit, Pricing, FAQ), new button system, polished hero.

### v2.6.0 — June 5, 2026
- Offline detection: devices flip to Offline after 45s of silence (15 min for LoRaWAN), with "last reading X ago" on the dashboard and device cards. Stale data can no longer appear live.
- Forgot password: email reset link with a branded set-new-password screen.
- Download my data: one-click JSON export of devices, alarms, journals, gateways, and settings.
- Version stamp in Settings (version + build date).
- History no longer records duplicate readings while a device is offline.

### v2.5.0 — June 5, 2026
- Documentation shipped into the repo: User Manual, Engineering Manual, Wiring Guide and Diagram, Product Roadmap, Deployment Model (PDF + markdown).
- Sanitized firmware and bench diagnostic sketches added under `firmware/`.
- Full README rewrite: architecture, setup, env vars, security model.

### v2.4.0 — June 5, 2026
- Disconnected-sensor detection: probes that are unplugged show "not connected" with fix-it hints instead of garbage values; health score counts only live sensors.
- Power status: AC/battery badges with charging state and low-battery warnings.
- Device groups (Greenhouse, Backyard, ...) with grouped Devices view.
- Shareable plant report: branded printable PDF with readings, stats, weather, and journal.
- Refresh-rate options became LoRaWAN-aware, with battery-drain guidance.
- Fixed device card text overflow on narrow screens.

### v2.3.0 — June 4, 2026
- Signup upgraded: first/last name, confirm password, grower type; the app greets users by name.
- Per-plant home location: weather and rain alerts follow the plant, not the owner's phone.
- Device management: rename, edit location, switch connection type, delete with full data purge.
- Factory reset for resale: remote Wi-Fi wipe via cloud command, with data-loss disclaimer.
- Connection choice at setup (Wi-Fi or LoRaWAN gateway); gateway management section; Ethernet retired.
- Desktop fix: onboarding screen no longer renders inside the sidebar column.

### v2.2.0 — June 4, 2026
- Installable app (PWA): Add to Home Screen with real icons, full-screen mode, notch/safe-area support.
- Form fields inherit the app font (fixed "shifted" text in inputs).

### v2.1.0 — June 3, 2026
- Pairing codes validated against the device registry (Supabase); junk codes rejected.
- Honest device states: claimed devices show "waiting for first reading" until real data arrives.

### v2.0.0 — June 3, 2026
- Real accounts (Supabase auth) with per-account data isolation.
- Demo mode for prospects, fully separated from real data.
- Live cloud readings through the secure `device-state` serverless connector.
- Claim-a-device onboarding for new accounts.

### v1.2.0 — June 3, 2026
- Losant cloud integration: device, access keys, telemetry simulator.
- Real email/SMS alert workflows (fire even with the app closed).

### v1.1.0 — June 2, 2026
- Plant profile catalog with species-specific ideal ranges.
- Weather rain gauge with rain-aware watering suggestions.
- Growth journal with photos; irrigation control card; subscription tiers; dark mode; smarter alarms with auto-set; device editing; richer history charts with ideal bands.

### v1.0.0 — June 1, 2026
- Initial app: live dashboard with health score, history charts, alarm rules, device list, full design system, simulated data.

---

## Device Firmware (GP_Provisioning)

### v2.3 — June 5, 2026
- Boot sensor self-test now holds on screen for 10 seconds so it's readable.
- Reports Wi-Fi signal strength (`wifiRssi`) in telemetry so the app can show the node's real connection instead of a user-set label.

### v2.2 — June 5, 2026
- Rotating status screen: the OLED cycles every ~5 seconds through the pairing code + connection state, a connection page (link type, Wi-Fi signal in dBm, IP address), and live sensor readings. Disconnected probes read "--" honestly.
- The screen now states the active link ("Wi-Fi"); a future LoRaWAN build flips `LINK_LABEL` so the unit always shows the truth of how it's connected.

### v2.1 — June 5, 2026
- Boot self-test: POST-style checklist on the OLED (soil temp / air / moisture) before going online.
- Hardware watchdog: automatic reboot on firmware hang, portal-aware so setup is never interrupted.
- OLED burn-in protection: screen dims after 5 idle minutes, any PRG tap wakes it.

### v2.0 — June 5, 2026
- Remote factory reset: the app sends a cloud command and the unit wipes its own Wi-Fi and reboots into setup mode for a new owner.

### v1.6 — June 4, 2026
- Soil moisture moved to GPIO2 (GPIO1 conflicts with the board's battery-sense circuit).
- Soil sensor powered from 5V (NE555 oscillator requires >4V; resolves frozen 100% readings).
- Raw soil ADC added to telemetry and the serial line for field calibration.

### v1.5 — June 4, 2026
- Pairing code displayed large on the built-in OLED (no Serial Monitor needed).
- PRG reset paths: hold at power-on, or hold 3 seconds any time, to wipe Wi-Fi and reopen setup.
- Captive-portal fixes: faster phone joins (no background scan-hopping, no modem sleep), setup window extended to 10 minutes.

### v1.0 — June 3, 2026
- Provisioning firmware: branded captive-portal Wi-Fi setup (logo, welcome page), chip-ID pairing code, Losant cloud streaming with auto-reconnect.

### v0.9 — late May 2026
- Team baseline sketch: sensor reads with hardcoded Wi-Fi credentials, serial output (original team repository).
