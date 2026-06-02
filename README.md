# GrowthPulse Web App

A live sensor monitoring app for the GrowthPulse plant nodes. Built with React + Vite.
Right now it runs on **simulated data** so you can see and demo the whole interface before
the hardware is wired to the cloud. Swapping in real Losant data later touches one file.

## Run it (first time)

You need **Node.js** installed. If you don't have it, get the LTS version from
https://nodejs.org and install it (just click through the installer).

Then, in a terminal:

```bash
cd "growthpulse-app"     # go into this folder
npm install              # download the libraries (one time, ~10s)
npm run dev              # start the app
```

The terminal prints a line like `Local: http://localhost:5173/`. Open that in your browser.
It opens on a sign-in screen, tap **continue as demo** (or type any email) to enter.

To stop the server, press `Ctrl + C` in the terminal. Next time you only need `npm run dev`.

## What's inside (the four tabs)

- **Live** – big readouts, a soil-moisture gauge, a 0-100 plant health score, per-sensor
  status colors (green / amber / red), and smart care recommendations.
- **History** – HOUR / DAY / WEEK / MONTH charts for each metric with Max / Avg / Min lines.
- **Alarms** – tune threshold rules with sliders and above/below toggles. A badge shows how
  many alarms are currently tripped.
- **Devices** – every node in one list (Wi-Fi, LoRaWAN, Ethernet), tap to switch, plus an
  add-device flow for picking how a new node connects.

## Where the data comes from (and the Losant swap)

All data and "smart" logic live in `src/store/`:

- `helpers.js` – sensor definitions, health/status logic, recommendations, and the mock
  data generators.
- `AppContext.jsx` – the shared store. Every 2 seconds it advances each device's reading.

When your node is sending to Losant, you replace the mock generator call inside
`AppContext.jsx` (and/or `helpers.js`) with a fetch to the Losant REST API that returns the
same field names: `airTemperatureF`, `airHumidity`, `soilTemperatureF`, `soilRaw`,
`soilMoisturePercent`. Nothing in the UI has to change.

## File map

```
src/
  main.jsx              app entry point
  index.css             the whole design system
  App.jsx               login gate + top bar + bottom tab navigation
  store/
    helpers.js          sensor metadata + smart logic + mock data
    AppContext.jsx      shared state (user, devices, alarms, live timer)
  components/
    UI.jsx              pills, toggle, slider, stepper, gauge, icons
    Chart.jsx           history chart with Max/Avg lines
    Login.jsx           sign-in screen
  views/
    LiveView.jsx        the Live tab
    HistoryView.jsx     the History tab
    AlarmsView.jsx      the Alarms tab
    DevicesView.jsx     the Devices tab + add-device sheet
```

## Note on credentials

Never commit real Wi-Fi or Losant secrets into this repo. Keep them in a `.env` /
`secrets` file (already listed in `.gitignore`).
