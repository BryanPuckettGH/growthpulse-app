/* ============================================================
   helpers.js
   The "brain" of the app: sensor metadata, the smart status and
   health logic, recommendations, and the mock data generators.
   Keep all data logic here so the UI stays simple.
   ============================================================ */

// --- math utils ---
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const mapRange = (x, a, b, c, d) => ((x - a) * (d - c)) / (b - a) + c;

// Soil calibration copied from the node firmware (node.ino).
const DRY = 3600; // raw ADC when bone dry
const WET = 1300; // raw ADC when soaked

/* Each metric: label, unit, and the ranges that define a healthy reading.
   good = ideal band, warn = acceptable band, outside warn = critical. */
export const METRICS = {
  airTemperatureF: { key: 'airTemperatureF', label: 'Temperature', short: 'Temp', unit: '°F', icon: 'temp', good: [65, 80], warn: [58, 88], min: 50, max: 100, color: '#f4a52b' },
  airHumidity: { key: 'airHumidity', label: 'Humidity', short: 'Humidity', unit: '%', icon: 'humidity', good: [40, 65], warn: [30, 75], min: 0, max: 100, color: '#13a4ff' },
  soilMoisturePercent: { key: 'soilMoisturePercent', label: 'Soil Moisture', short: 'Moisture', unit: '%', icon: 'moisture', good: [40, 80], warn: [25, 90], min: 0, max: 100, color: '#2ecc71' },
  soilTemperatureF: { key: 'soilTemperatureF', label: 'Soil Temp', short: 'Soil Temp', unit: '°F', icon: 'soil', good: [62, 75], warn: [55, 82], min: 40, max: 95, color: '#a06bff' },
  // Not a device sensor: rain comes from the weather forecast, used only for rain alarms.
  rainChance: { key: 'rainChance', label: 'Rain chance', short: 'Rain', unit: '%', icon: 'rain', good: [0, 100], warn: [0, 100], min: 0, max: 100, color: '#13a4ff' },
};

export const METRIC_ORDER = ['airTemperatureF', 'airHumidity', 'soilMoisturePercent', 'soilTemperatureF'];

// Plant catalog lives in plants.js (a large searchable database). Re-export it
// here so existing imports keep working.
import { PLANTS } from './plants';
export { PLANTS };

// Build the default range table from the metric metadata.
export function defaultRanges() {
  const r = {};
  for (const k of METRIC_ORDER) r[k] = { good: METRICS[k].good, warn: METRICS[k].warn };
  return r;
}

// The effective ideal ranges for a device, with its plant's ranges layered on top.
export function rangesForDevice(device) {
  const base = defaultRanges();
  const plant = device && device.plant ? PLANTS[device.plant] : null;
  if (!plant || !plant.ranges) return base;
  return { ...base, ...plant.ranges };
}

// good / warn / critical for one value, optionally against plant-specific ranges
export function statusOf(key, value, ranges) {
  const band = (ranges && ranges[key]) || (METRICS[key] && { good: METRICS[key].good, warn: METRICS[key].warn });
  if (!band || value == null) return 'good';
  const [gl, gh] = band.good;
  const [wl, wh] = band.warn;
  if (value >= gl && value <= gh) return 'good';
  if (value >= wl && value <= wh) return 'warn';
  return 'critical';
}

// 0-100 overall plant health from the four metrics
export function healthScore(reading, ranges) {
  const weight = { good: 100, warn: 66, critical: 28 };
  const scores = METRIC_ORDER.map((k) => weight[statusOf(k, reading[k], ranges)]);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// Human, plant-care recommendations, tuned to the device's plant ranges.
export function recommendations(reading, ranges) {
  const R = ranges || defaultRanges();
  const out = [];
  const sm = reading.soilMoisturePercent;
  const t = reading.airTemperatureF;
  const h = reading.airHumidity;

  if (sm < R.soilMoisturePercent.warn[0])
    out.push({ level: 'critical', text: 'Soil is very dry. Water the plant now.' });
  else if (sm < R.soilMoisturePercent.good[0])
    out.push({ level: 'warn', text: 'Soil moisture is getting low. Plan to water soon.' });
  else if (sm > R.soilMoisturePercent.warn[1])
    out.push({ level: 'warn', text: 'Soil is waterlogged. Hold off on watering and check drainage.' });

  if (t > R.airTemperatureF.warn[1])
    out.push({ level: 'critical', text: 'Air temperature is high. Add ventilation or shade.' });
  else if (t < R.airTemperatureF.warn[0])
    out.push({ level: 'warn', text: 'Air temperature is low for this plant.' });

  if (h < R.airHumidity.warn[0])
    out.push({ level: 'warn', text: 'Humidity is low. Consider misting or a humidifier.' });
  else if (h > R.airHumidity.warn[1])
    out.push({ level: 'warn', text: 'Humidity is high. Improve airflow to avoid mold.' });

  if (out.length === 0) out.push({ level: 'good', text: 'Everything looks ideal for this plant.' });
  return out;
}

// --- mock data generation (replace with Losant later) ---
function finalize(r) {
  const soilMoisturePercent = Math.round(clamp(mapRange(r.soilRaw, DRY, WET, 0, 100), 0, 100));
  return { ...r, soilMoisturePercent, time: Date.now() };
}

export function seedReading(base = {}) {
  return finalize({
    airTemperatureF: base.airTemperatureF ?? +(70 + Math.random() * 8).toFixed(1),
    airHumidity: base.airHumidity ?? +(45 + Math.random() * 20).toFixed(1),
    soilTemperatureF: base.soilTemperatureF ?? +(64 + Math.random() * 8).toFixed(1),
    soilRaw: base.soilRaw ?? Math.round(1700 + Math.random() * 1500),
  });
}

export function nextReading(prev) {
  const drift = (v, d) => v + (Math.random() - 0.5) * d;
  return finalize({
    airTemperatureF: +clamp(drift(prev.airTemperatureF, 0.6), 55, 95).toFixed(1),
    airHumidity: +clamp(drift(prev.airHumidity, 1.6), 25, 85).toFixed(1),
    soilTemperatureF: +clamp(drift(prev.soilTemperatureF, 0.4), 50, 90).toFixed(1),
    soilRaw: Math.round(clamp(drift(prev.soilRaw, 90), WET, DRY)),
  });
}

/* Build a history series for the HOUR/DAY/WEEK/MONTH charts, with the
   Max / Avg / Min stats shown in the reference design. */
export function buildSeries(key, range, good) {
  const conf = {
    HOUR: { n: 60, stepMs: 60000, fmt: (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    DAY: { n: 24, stepMs: 3600000, fmt: (d) => d.toLocaleTimeString([], { hour: '2-digit' }) },
    WEEK: { n: 7, stepMs: 86400000, fmt: (d) => d.toLocaleDateString([], { weekday: 'short' }) },
    MONTH: { n: 30, stepMs: 86400000, fmt: (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' }) },
  }[range];

  const m = METRICS[key];
  const band = good || m.good;
  const mid = (band[0] + band[1]) / 2;
  const amp = band[1] - band[0];
  const now = Date.now();
  let v = mid;
  const points = [];
  for (let i = conf.n - 1; i >= 0; i--) {
    v = clamp(v + (Math.random() - 0.5) * amp * 0.45, m.min, m.max);
    points.push({ t: conf.fmt(new Date(now - i * conf.stepMs)), value: +v.toFixed(1) });
  }
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  return { points, min, max, avg };
}

// Which configured alarm rules are currently tripped
export function activeAlerts(devices, rules, weather) {
  const out = [];
  for (const r of rules) {
    if (!r.enabled) continue;

    // Rain alarms evaluate once against the shared forecast, not per device.
    if (r.metric === 'rainChance') {
      const v = weather && weather.rainChance;
      if (v == null) continue;
      const hit = r.op === 'below' ? v < r.value : v > r.value;
      if (hit) out.push({ device: null, rule: r, value: v });
      continue;
    }

    for (const d of devices) {
      if (r.deviceId && r.deviceId !== 'all' && r.deviceId !== d.id) continue;
      const v = d.reading[r.metric];
      if (v == null) continue;
      const hit = r.op === 'below' ? v < r.value : v > r.value;
      if (hit) out.push({ device: d, rule: r, value: v });
    }
  }
  return out;
}

// Generate a starter alarm set from a device's plant ideal ranges.
export function alarmsFromPlant(deviceId, ranges) {
  return [
    { metric: 'soilMoisturePercent', op: 'below', value: ranges.soilMoisturePercent.good[0], deviceId },
    { metric: 'airTemperatureF', op: 'above', value: ranges.airTemperatureF.good[1], deviceId },
    { metric: 'airHumidity', op: 'below', value: ranges.airHumidity.good[0], deviceId },
  ];
}

// The two ways a node gets online: its own Wi-Fi, or through a LoRaWAN
// gateway (Farm Kit). Ethernet isn't offered on current hardware.
export const TRANSPORTS = {
  wifi: { label: 'Wi-Fi', icon: 'wifi', color: '#13a4ff' },
  lorawan: { label: 'LoRaWAN', icon: 'lora', color: '#a06bff' },
};

// --- display helpers for units and trends ---
const TEMP_KEYS = ['airTemperatureF', 'soilTemperatureF'];

export function convertTemp(valueF, units) {
  return units === 'C' ? Math.round((((valueF - 32) * 5) / 9) * 10) / 10 : valueF;
}
export function displayValue(key, value, units) {
  return TEMP_KEYS.includes(key) ? convertTemp(value, units) : value;
}
export function displayUnit(metricUnit, units) {
  return metricUnit === '°F' && units === 'C' ? '°C' : metricUnit;
}
export function trendOf(history, key) {
  if (!history || history.length < 2) return 'flat';
  const prev = history[history.length - 2][key];
  const curr = history[history.length - 1][key];
  if (curr > prev) return 'up';
  if (curr < prev) return 'down';
  return 'flat';
}
