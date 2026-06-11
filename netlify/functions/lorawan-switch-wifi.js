// Switch a node that is currently on LoRaWAN back to Wi-Fi.
//
// Once a board is on LoRaWAN it is no longer on Losant's MQTT, so we can't reach
// it with a Losant command (the way provision-lorawan.js pushes keys). The only
// path down to a LoRaWAN class-A node is a scheduled DOWNLINK that rides on the
// reply to its next uplink. The firmware (lwSendReading) watches for a 1-byte
// 0x00 downlink and, on receiving it, reboots into Wi-Fi mode.
//
// The app POSTs the board's Losant device id with the signed-in user's session.
// We validate the user, look up the matching TTS device id (stored by
// provision-lorawan.js in the lorawan_devices route table), and enqueue the
// 0x00 downlink via the TTS Application Server. Delivery happens on the node's
// next uplink (so up to one reading interval later).
//
// Env vars (Netlify):
//   TTS_API_KEY        TTS API key with downlink write rights on the application
//   TTS_APP_ID         the TTS application id
//   TTS_CLUSTER        host, e.g. nam1.cloud.thethings.network (default nam1)
//   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY    validate the caller
//   SUPABASE_SERVICE_ROLE_KEY                     read the route (bypass RLS)

const SWITCH_FPORT = 2;            // matches the firmware UPLINK_FPORT
const SWITCH_PAYLOAD_B64 = 'AA=='; // a single 0x00 byte

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only' }) };
  }

  // 1. Validate the signed-in user.
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !supaUrl || !anon) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not signed in' }) };
  }
  try {
    const who = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!who.ok) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'Auth check failed' }) };
  }

  // 2. Inputs: the board's Losant device id (its persistent identity).
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  const losantDeviceId = String(body.losantDeviceId || '').trim();
  if (!/^[0-9a-fA-F]{24}$/.test(losantDeviceId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'losantDeviceId (24 hex) required' }) };
  }

  // 3. Config + find the TTS device that routes to this Losant device.
  const apiKey = process.env.TTS_API_KEY;
  const appId = process.env.TTS_APP_ID;
  const cluster = process.env.TTS_CLUSTER || 'nam1.cloud.thethings.network';
  if (!apiKey || !appId || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured (TTS/Supabase env)' }) };
  }

  let ttsDeviceId = '';
  try {
    const q = `${supaUrl}/rest/v1/lorawan_devices?losant_device_id=eq.${encodeURIComponent(losantDeviceId)}&select=tts_device_id&order=created_at.desc&limit=1`;
    const lookup = await fetch(q, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (lookup.ok) {
      const rows = await lookup.json();
      if (Array.isArray(rows) && rows[0] && rows[0].tts_device_id) ttsDeviceId = rows[0].tts_device_id;
    }
  } catch { /* fall through */ }
  if (!ttsDeviceId) {
    return { statusCode: 404, body: JSON.stringify({ error: 'No LoRaWAN route for this device (was it provisioned?)' }) };
  }

  // 4. Enqueue the 0x00 downlink on the Application Server. "replace" clears any
  // older pending switch command so we don't stack duplicates.
  try {
    const res = await fetch(
      `https://${cluster}/api/v3/as/applications/${appId}/devices/${encodeURIComponent(ttsDeviceId)}/down/replace`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          downlinks: [{ f_port: SWITCH_FPORT, frm_payload: SWITCH_PAYLOAD_B64, priority: 'NORMAL' }],
        }),
      }
    );
    if (!res.ok) {
      const detail = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'TTS rejected downlink', detail }) };
    }
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }

  // The node applies this on its next uplink (class A), then reboots to Wi-Fi.
  return { statusCode: 200, body: JSON.stringify({ ok: true, ttsDeviceId, queued: true }) };
};
