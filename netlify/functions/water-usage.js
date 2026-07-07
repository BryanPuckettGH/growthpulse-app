// Water usage over time, computed from the node's cumulative water meter.
//
//   GET /.netlify/functions/water-usage?deviceId=...&start=<ms>&end=<ms>&bucketMs=<ms>
//   -> { start, end, bucketMs, totalLiters, buckets: [{ t, liters }] }
//
// The firmware reports waterTotalL as a lifetime cumulative counter (the same
// trick utility meters use), which makes usage resilient to missed samples:
// usage in a bucket = the rise of the counter across that bucket. We query
// Losant for the MAX of waterTotalL per bucket and diff consecutive buckets.
// A counter reset (re-flashed node, wiped NVS) shows up as a negative diff;
// we then count the bucket's own value, i.e. water since the reset.
//
// Bucket alignment is the caller's job: pass a start aligned to local
// midnight and bucketMs = 86400000 for daily buckets in the user's timezone.
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
  const HOUR = 3600000;
  const DAY = 86400000;
  let bucketMs = Number(params.bucketMs) || DAY;
  bucketMs = Math.max(HOUR, Math.min(bucketMs, 7 * DAY));
  if (!deviceId || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { statusCode: 400, body: JSON.stringify({ error: 'deviceId, start and end (ms) required' }) };
  }
  if ((end - start) / bucketMs > 400) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Too many buckets; raise bucketMs' }) };
  }

  try {
    // One extra bucket before `start` gives the first real bucket a baseline.
    const res = await fetch(`https://api.losant.com/applications/${appId}/data/time-series-query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: start - bucketMs,
        end,
        resolution: bucketMs,
        aggregation: 'MAX',
        attributes: ['waterTotalL'],
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

    // Index the counter maxima by bucket timestamp.
    const maxima = new Map();
    for (const p of raw) {
      const d = p.data || p;
      const v = d.waterTotalL;
      if (typeof v === 'number' && Number.isFinite(v)) maxima.set(new Date(p.time).getTime(), v);
    }

    // Walk the requested buckets, diffing against the last counter value seen.
    // Buckets with no data report 0; the next bucket with data absorbs the
    // counter's rise across the gap (usage is never lost, just attributed late).
    const buckets = [];
    let lastKnown = null;
    let totalLiters = 0;
    for (let t = start - bucketMs; t < end; t += bucketMs) {
      const v = maxima.get(t);
      const inRange = t >= start;
      if (v != null) {
        let liters = 0;
        if (lastKnown != null) {
          const diff = v - lastKnown;
          liters = diff >= 0 ? diff : v; // negative diff = counter reset
        }
        lastKnown = v;
        if (inRange) {
          liters = Math.round(liters * 100) / 100;
          buckets.push({ t, liters });
          totalLiters += liters;
        }
      } else if (inRange) {
        buckets.push({ t, liters: 0 });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ start, end, bucketMs, totalLiters: Math.round(totalLiters * 100) / 100, buckets }),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e) }) };
  }
};
