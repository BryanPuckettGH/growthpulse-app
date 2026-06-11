// Receives LoRaWAN uplinks from The Things Stack (Sandbox / TTN) via a custom
// webhook and forwards the decoded reading into the same device cloud (Losant)
// the Wi-Fi path uses, so a LoRaWAN node shows up in the app exactly like a
// Wi-Fi node.
//
// Setup (see docs/GrowthPulse LoRaWAN Bring-Up Guide.md):
//   TTS Application -> Integrations -> Webhooks -> Custom webhook
//     Base URL: https://growthpulsecloud.com/.netlify/functions/lorawan-uplink
//     Uplink message path: /          (so it POSTs the base URL)
//     Header: X-Webhook-Token: <secret>   (must equal env LORAWAN_WEBHOOK_TOKEN)
//
// Env vars (Netlify):
//   LORAWAN_WEBHOOK_TOKEN   shared secret so only TTS can call this
//   LOSANT_APP_ID           existing
//   LOSANT_COMMAND_TOKEN    existing write-capable token (used here to POST state)
//
// Mapping: TTS device_id -> Losant device id. For the bench we map the one
// node; productionize this with a lookup table or a Supabase row keyed by
// dev_eui. Set LORAWAN_DEVICE_MAP as JSON like
//   {"growthpulse-node-01":"6a1fb486df527c8bf8d3324b"}
// Decode the 9-byte uplink the firmware packs in lwSendReading():
//   [0..1] soilTemperatureF * 10, int16 BE  (0x8000 = sensor absent)
//   [2..3] airTemperatureF  * 10, int16 BE
//   [4]    airHumidity %,           uint8
//   [5..6] soilRaw (0-4095),        uint16 BE
//   [7]    soilMoisturePercent,     uint8
//   [8]    batteryPct (0-100),      uint8   (0xFF = unknown)
function decodeFrmPayload(b64) {
  if (!b64 || typeof b64 !== 'string') return null;
  let buf;
  try { buf = Buffer.from(b64, 'base64'); } catch { return null; }
  if (buf.length < 9) return null;
  const s16 = (hi, lo) => { let v = (hi << 8) | lo; if (v & 0x8000) v -= 0x10000; return v; };
  const soilWord = (buf[0] << 8) | buf[1];
  return {
    soilTemperatureF: soilWord === 0x8000 ? null : s16(buf[0], buf[1]) / 10,
    airTemperatureF: s16(buf[2], buf[3]) / 10,
    airHumidity: buf[4],
    soilRaw: (buf[5] << 8) | buf[6],
    soilMoisturePercent: buf[7],
    batteryPct: buf[8] === 0xFF ? null : buf[8],
  };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only' }) };
  }

  // Only The Things Stack (carrying our secret header) may call this.
  const expected = process.env.LORAWAN_WEBHOOK_TOKEN;
  if (expected) {
    const got = event.headers['x-webhook-token'] || event.headers['X-Webhook-Token'];
    if (got !== expected) {
      console.error('[lorawan-uplink] 401 bad webhook token (LORAWAN_WEBHOOK_TOKEN mismatch)');
      return { statusCode: 401, body: JSON.stringify({ error: 'Bad webhook token' }) };
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) };
  }

  const up = body.uplink_message;
  const ids = body.end_device_ids || {};
  if (!up) {
    // TTS also posts join/other events to the same URL if misconfigured; ignore.
    return { statusCode: 200, body: JSON.stringify({ ignored: 'no uplink_message' }) };
  }

  // Prefer the TTS payload formatter if one is set, but don't depend on it:
  // auto-provisioned devices may not have a formatter, so decode the 9 raw bytes
  // ourselves (same packing the firmware uses in lwSendReading()).
  let decoded = up.decoded_payload;
  if (!decoded || typeof decoded !== 'object') {
    decoded = decodeFrmPayload(up.frm_payload);
  }
  if (!decoded || typeof decoded !== 'object') {
    console.error('[lorawan-uplink] 422 could not decode. frm_payload=', up.frm_payload);
    return { statusCode: 422, body: JSON.stringify({ error: 'No decoded_payload and frm_payload not decodable' }) };
  }

  // Resolve which Losant device this TTS device maps to: static env map first,
  // then the Supabase route table (auto-provisioned devices), then a default.
  const ttsDeviceId = ids.device_id || '';
  let map = {};
  try { map = JSON.parse(process.env.LORAWAN_DEVICE_MAP || '{}'); } catch { map = {}; }
  let losantDeviceId = map[ttsDeviceId] || '';
  if (!losantDeviceId && process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && ttsDeviceId) {
    try {
      const q = `${process.env.VITE_SUPABASE_URL}/rest/v1/lorawan_devices?tts_device_id=eq.${encodeURIComponent(ttsDeviceId)}&select=losant_device_id`;
      const lookup = await fetch(q, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
      if (lookup.ok) {
        const rows = await lookup.json();
        if (Array.isArray(rows) && rows[0] && rows[0].losant_device_id) losantDeviceId = rows[0].losant_device_id;
      }
    } catch { /* fall through to the default below */ }
  }
  if (!losantDeviceId) losantDeviceId = process.env.LORAWAN_DEFAULT_DEVICE_ID || '';
  if (!losantDeviceId) {
    console.error(`[lorawan-uplink] 404 no Losant mapping for TTS device "${ttsDeviceId}"`);
    return { statusCode: 404, body: JSON.stringify({ error: `No Losant mapping for TTS device "${ttsDeviceId}"` }) };
  }
  console.log(`[lorawan-uplink] tts=${ttsDeviceId} -> losant=${losantDeviceId}`);

  // Build the same state shape the Wi-Fi node sends. Clean any sentinels the
  // same way the rest of the pipeline does.
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  let soilTemperatureF = num(decoded.soilTemperatureF);
  if (soilTemperatureF != null && soilTemperatureF < -100) soilTemperatureF = null;
  const rawState = {
    soilTemperatureF,
    airTemperatureF: num(decoded.airTemperatureF),
    airHumidity: num(decoded.airHumidity),
    soilRaw: num(decoded.soilRaw),
    soilMoisturePercent: num(decoded.soilMoisturePercent),
    batteryPct: num(decoded.batteryPct),
    // Tag the link so the app can show LoRaWAN + signal honestly.
    transport: 'lorawan',
    loraRssi: up.rx_metadata && up.rx_metadata[0] ? num(up.rx_metadata[0].rssi) : null,
    loraSnr: up.rx_metadata && up.rx_metadata[0] ? num(up.rx_metadata[0].snr) : null,
  };
  // Losant validates each attribute's type and rejects null for a Number
  // attribute (which fails the whole update). Only send keys that actually have
  // a value; a disconnected sensor simply isn't reported, and the app reads a
  // missing attribute as "not connected", exactly like the Wi-Fi path.
  const state = {};
  for (const k in rawState) {
    if (rawState[k] !== null && rawState[k] !== undefined) state[k] = rawState[k];
  }

  const appId = process.env.LOSANT_APP_ID;
  const token = process.env.LOSANT_COMMAND_TOKEN;
  if (!appId || !token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  try {
    const res = await fetch(
      `https://api.losant.com/applications/${appId}/devices/${encodeURIComponent(losantDeviceId)}/state`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: state }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`[lorawan-uplink] 502 Losant rejected state for ${losantDeviceId}: ${text} | state=${JSON.stringify(state)}`);
      return { statusCode: 502, body: JSON.stringify({ error: 'Losant rejected state', detail: text }) };
    }
    console.log(`[lorawan-uplink] 200 forwarded to ${losantDeviceId}`);
    return { statusCode: 200, body: JSON.stringify({ forwarded: true, device: losantDeviceId }) };
  } catch (e) {
    console.error('[lorawan-uplink] 502 exception:', String(e && e.message || e));
    return { statusCode: 502, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
