# GrowthPulse Product Roadmap

A phased plan to take GrowthPulse from a live demo app to a full consumer product. Grounded in the Team 15 final senior design proposal.

## The product in one line

A plant-monitoring system where someone buys a GrowthPulse sensor node, adds it to their account, picks what they are growing, and gets live readings, smart alerts, and weather-aware watering guidance, with a free tier for house plants and a premium tier for full yard automation.

## Where it is today (Phase 0, done)

- Branded React app, live at growthpulsecloud.com, deployed from GitHub through Netlify.
- Screens: Live dashboard, History, Alarms, Devices, Settings.
- Smart status colors, a 0 to 100 plant health score, and plant-care recommendations.
- Multi-device across Wi-Fi, LoRaWAN, and Ethernet, with light and dark themes, °F/°C units, refresh-rate control, settings persistence, and a saved login session.
- Plant profiles: pick a plant and its ideal ranges and alarm thresholds auto-adjust.
- Weather virtual rain gauge: local forecast plus rain and heavy-sun watering heads-ups.
- Runs on simulated data, structured so real data swaps in at a single point.

## Phase 1 — Real sensor data

Goal: the dashboard shows your actual node instead of mock data.

- Set up Losant (create the device, generate an access key).
- Put the credentials in the node firmware, confirm telemetry lands in Losant.
- Wire the app data hook (the marked swap point in `AppContext.jsx`) to the Losant REST API for polling, or its MQTT feed for real time.

Unlocks: a genuinely live product running on your real hardware.
Needs: a Losant account and the node online.

## Phase 2 — Accounts and device claiming

Goal: real users, each owning their own devices.

- Stand up a backend with authentication and a database (Supabase is the recommended beginner-friendly option; Losant Experiences is an alternative).
- Replace demo login with real signup and login.
- Add "claim a device": the buyer enters the device ID that ships with the node, which ties it to their account.
- Store devices, plant choices, and alarms per user in the cloud instead of only the browser.

Unlocks: the buy-on-Amazon-and-add-it flow, and real multi-user support for customers or teammates.
Needs: a backend service and auth.

## Phase 3 — Subscription tiers

Goal: the monetization model from the proposal.

- Define tiers: Free (house plants, a limited number of devices, monitoring only) versus Premium (yard zones, more devices, LoRaWAN and irrigation).
- Gate features in the app by the user's tier.
- Add billing with Stripe.

Unlocks: the tiered revenue model studied in the proposal (OKO and FYTA style bundles).
Needs: the Phase 2 backend, plus Stripe.

## Phase 4 — LoRaWAN and irrigation

Goal: long-range outdoor deployment and automated watering, the premium hardware story.

- Bring the ThinkNode G1 gateway online with The Things Network, and rewrite the node firmware for LoRaWAN on US915.
- Add irrigation control (valve or pump) driven by soil moisture combined with the weather rain gauge, skipping watering when rain is forecast, matching the proposal's virtual rain gauge and evapotranspiration approach.
- Support multiple yard zones.

Unlocks: the full GrowthPulse vision of large-scale, water-efficient, autonomous plant care.
Needs: the gateway online and irrigation hardware.

## Why this order

Each phase unlocks the next: real data before accounts, accounts before billing, billing before the premium hardware tier. Plant profiles and weather are already done and work at every phase because they live entirely in the frontend.
