// Secure connector between the app and Losant. Holds the Losant read-only API
// token server-side (a Netlify env var) so it is never exposed to the browser.
// The app calls /.netlify/functions/device-state?deviceId=XXX and gets back the
// latest reading for that device.
export const handler = async (event) => {
  const token = process.env.LOSANT_API_TOKEN;
  const appId = process.env.LOSANT_APP_ID;
  const deviceId = event.queryStringParameters && event.queryStringParameters.deviceId;

  if (!token || !appId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }
  if (!deviceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'deviceId required' }) };
  }

  try {
    const res = await fetch(
      `https://api.losant.com/applications/${appId}/devices/${deviceId}/compositeState`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'Device not found or unauthorized' }) };
    }
    const s = await res.json();
    const num = (k) => (s[k] && typeof s[k].value === 'number' ? s[k].value : null);
    const bool = (k) => (s[k] && typeof s[k].value === 'boolean' ? s[k].value : null);
    const reading = {
      airTemperatureF: num('airTemperatureF'),
      airHumidity: num('airHumidity'),
      soilTemperatureF: num('soilTemperatureF'),
      soilRaw: num('soilRaw'),
      soilMoisturePercent: num('soilMoisturePercent'),
      // Battery-powered units (future firmware) report these; AC units don't.
      batteryPct: num('batteryPct'),
      charging: bool('charging'),
      time: s.soilMoisturePercent ? new Date(s.soilMoisturePercent.time).getTime() : Date.now(),
    };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(reading),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Upstream fetch failed' }) };
  }
};
