// Self-provisioning endpoint: every GrowthPulse board runs the SAME firmware
// (no per-board secrets). On first boot a board POSTs its pairing code (derived
// from its chip MAC) plus a shared firmware token; this function gives that
// board its own Losant device + access key, so it shows up in the app as its
// own plant. Flash 1 board or 1,000 with one identical image.
//
//   POST { "code": "4A7AC", "token": "<shared firmware token>" }
//   -> { "deviceId": "...", "accessKey": "...", "accessSecret": "..." }
//
// Backward compatible: a code already in the registry (e.g. the demo unit's
// 4A7AC) keeps its existing Losant device; we just mint it a fresh key.
//
// Env vars (Netlify):
//   PROVISION_TOKEN              shared secret baked into the firmware
//   LOSANT_APP_ID               existing
//   LOSANT_PROVISION_API_TOKEN  Losant API token with devices.post + applicationKeys.post
//   VITE_SUPABASE_URL           existing
//   SUPABASE_SERVICE_ROLE_KEY   service role key (bypasses RLS to read/insert the registry)
//
// The device is created with every attribute the app reads already defined, so
// telemetry is never dropped for an undefined attribute.
const ATTRS = [
  { name: 'airTemperatureF', dataType: 'number' },
  { name: 'airHumidity', dataType: 'number' },
  { name: 'soilTemperatureF', dataType: 'number' },
  { name: 'soilRaw', dataType: 'number' },
  { name: 'soilMoisturePercent', dataType: 'number' },
  { name: 'wifiRssi', dataType: 'number' },
  { name: 'batteryPct', dataType: 'number' },
  { name: 'charging', dataType: 'boolean' },
  // LoRaWAN link telemetry (set by the TTS uplink webhook for nodes that join
  // through a gateway). Defined here so LoRaWAN state is never dropped.
  { name: 'loraRssi', dataType: 'number' },
  { name: 'loraSnr', dataType: 'number' },
  { name: 'transport', dataType: 'string' },
];

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) }; }

  // Authenticate the board with the shared firmware token.
  const provToken = process.env.PROVISION_TOKEN;
  if (provToken && body.token !== provToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Bad provisioning token' }) };
  }

  // Pairing code: uppercase hex, derived from the chip MAC (1-6 hex chars).
  const code = String(body.code || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'code required' }) };
  }

  const appId = process.env.LOSANT_APP_ID;
  const losantToken = process.env.LOSANT_PROVISION_API_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appId || !losantToken || !supaUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  const losantHeaders = { Authorization: `Bearer ${losantToken}`, 'Content-Type': 'application/json', Accept: 'application/json' };
  const supaHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  try {
    // 1) Has this code already been provisioned? (Registry maps code -> device.)
    const lookup = await fetch(
      `${supaUrl}/rest/v1/device_registry?claim_code=eq.${encodeURIComponent(code)}&select=losant_device_id`,
      { headers: supaHeaders }
    );
    const rows = lookup.ok ? await lookup.json() : [];
    let deviceId = Array.isArray(rows) && rows[0] ? rows[0].losant_device_id : null;

    // 2) New board -> create its Losant device and register the mapping.
    if (!deviceId) {
      const devRes = await fetch(`https://api.losant.com/applications/${appId}/devices`, {
        method: 'POST',
        headers: losantHeaders,
        body: JSON.stringify({
          name: `GrowthPulse ${code}`,
          description: 'Auto-provisioned GrowthPulse node',
          deviceClass: 'standalone',
          tags: [{ key: 'code', value: code }],
          attributes: ATTRS,
        }),
      });
      if (!devRes.ok) {
        const t = await devRes.text();
        return { statusCode: 502, body: JSON.stringify({ error: 'Losant device create failed', detail: t }) };
      }
      const dev = await devRes.json();
      deviceId = dev.deviceId || dev.id;

      // Register code -> device so the customer's claim works and we don't
      // create a duplicate device next boot.
      const reg = await fetch(`${supaUrl}/rest/v1/device_registry`, {
        method: 'POST',
        headers: { ...supaHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ claim_code: code, losant_device_id: deviceId }),
      });
      if (!reg.ok && reg.status !== 409) {
        const t = await reg.text();
        return { statusCode: 502, body: JSON.stringify({ error: 'Registry insert failed', detail: t }) };
      }
    }

    // 3) Mint a fresh access key scoped to just this device (handles first
    //    provision and re-provision after a factory reset / NVS wipe).
    const keyRes = await fetch(`https://api.losant.com/applications/${appId}/keys`, {
      method: 'POST',
      headers: losantHeaders,
      body: JSON.stringify({
        name: `GP ${code} ${new Date().toISOString().slice(0, 10)}`,
        filterType: 'whitelist',
        deviceIds: [deviceId],
        pubTopics: [],
        subTopics: [],
      }),
    });
    if (!keyRes.ok) {
      const t = await keyRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Losant key create failed', detail: t }) };
    }
    const key = await keyRes.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ deviceId, accessKey: key.key, accessSecret: key.secret }),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
