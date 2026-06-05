// Historical sensor data for the plant report. Wraps the device cloud's
// time-series store (every reading since the unit first connected) behind a
// simple GET, using the read-only API token. The browser never sees the token.
//
//   GET /.netlify/functions/device-history?deviceId=...&start=<ms>&end=<ms>
//   -> { start, end, resolution, points: [{ t, airTemperatureF, ... }] }
//
// Resolution auto-scales so a report never carries more than ~240 chart
// points no matter how long the period is (a year collapses into ~1.5 day
// buckets, a day stays at 6 minute detail).
const ATTRS = ['airTemperatureF', 'airHumidity', 'soilTemperatureF', 'soilRaw', 'soilMoisturePercent'];

export const handler = async (event) => {
  const token = process.env.LOSANT_API_TOKEN;
  const appId = process.env.LOSANT_APP_ID;
  if (!token || !appId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  const params = event.queryStringParameters || {};
  const deviceId = params.deviceId;
  const start = Number(params.start);
  const end = Number(params.end);
  if (!deviceId || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { statusCode: 400, body: JSON.stringify({ error: 'deviceId, start and end (ms) required' }) };
  }

  // Bucket size: at most ~240 points, never finer than 1 minute.
  const MAX_POINTS = 240;
  const MINUTE = 60000;
  const resolution = Math.max(MINUTE, Math.ceil((end - start) / MAX_POINTS / MINUTE) * MINUTE);

  try {
    const res = await fetch(`https://api.losant.com/applications/${appId}/data/time-series-query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start,
        end,
        resolution,
        aggregation: 'MEAN',
        attributes: ATTRS,
        deviceIds: [deviceId],
        order: 'asc',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: text }) };
    }
    const data = await res.json();
    const dev = (data.devices && data.devices[deviceId]) || {};
    const raw = Array.isArray(dev.points) ? dev.points : [];

    // Normalize and clean each bucket. Disconnected-sensor sentinels (the
    // soil probe's -127C, a dry-shorted moisture probe) must not pollute the
    // averages, so they become honest nulls (gaps in the chart).
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    let points = raw.map((p) => {
      const d = p.data || p;
      let soilTemperatureF = num(d.soilTemperatureF);
      if (soilTemperatureF != null && soilTemperatureF < -100) soilTemperatureF = null;
      let airHumidity = num(d.airHumidity);
      if (airHumidity != null && airHumidity <= 0) airHumidity = null;
      const soilRaw = num(d.soilRaw);
      let soilMoisturePercent = num(d.soilMoisturePercent);
      if (soilRaw != null && soilRaw < 300) soilMoisturePercent = null;
      return {
        t: new Date(p.time).getTime(),
        airTemperatureF: num(d.airTemperatureF),
        airHumidity,
        soilTemperatureF,
        soilMoisturePercent,
      };
    });

    // Trim the empty lead/tail (e.g. "everything" ranges that start before
    // the unit existed) but keep interior gaps so offline stretches show.
    const hasData = (p) => p.airTemperatureF != null || p.airHumidity != null || p.soilTemperatureF != null || p.soilMoisturePercent != null;
    let a = 0;
    let b = points.length - 1;
    while (a <= b && !hasData(points[a])) a++;
    while (b >= a && !hasData(points[b])) b--;
    points = points.slice(a, b + 1);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ start, end, resolution, points }),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e) }) };
  }
};
