// Auto-provision a board for LoRaWAN. The LoRaWAN twin of provision-device.js.
//
// When the app switches a device to LoRaWAN, it POSTs the board's Losant device
// id here with the signed-in user's session token. This function:
//   1. validates the user,
//   2. generates fresh OTAA keys (DevEUI + AppKey; JoinEUI = zeros),
//   3. creates a unique end-device on The Things Stack via the 4-call API
//      (Identity, Join, Network, Application servers),
//   4. stores the route TTS device -> the board's Losant device in Supabase,
//   5. pushes the keys down to the board via a Losant command, so the board
//      (currently online over Wi-Fi) saves them and reboots into LoRaWAN.
//
// The board then joins through any gateway, and its uplinks land on the SAME
// Losant device it used over Wi-Fi (so it's one plant in the app, two transports).
//
// Env vars (Netlify):
//   TTS_API_KEY        TTS API key with device write rights on the application
//   TTS_APP_ID         the TTS application id (e.g. growthpulse)
//   TTS_CLUSTER        host, e.g. nam1.cloud.thethings.network (default nam1)
//   TTS_FREQ_PLAN      e.g. US_902_928_FSB_2 (default)
//   LOSANT_APP_ID            existing
//   LOSANT_COMMAND_TOKEN     existing (write-capable, to send the command)
//   VITE_SUPABASE_URL        existing
//   VITE_SUPABASE_ANON_KEY   existing (validate the caller)
//   SUPABASE_SERVICE_ROLE_KEY existing (store the route, bypassing RLS)

import { randomBytes } from 'node:crypto';

const hex = (buf) => Buffer.from(buf).toString('hex').toUpperCase();

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
  let userId = '';
  try {
    const who = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!who.ok) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };
    const u = await who.json();
    userId = u.id || '';
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'Auth check failed' }) };
  }

  // 2. Inputs: the board's Losant device id (its existing Wi-Fi identity).
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  const losantDeviceId = String(body.losantDeviceId || '').trim();
  if (!/^[0-9a-fA-F]{24}$/.test(losantDeviceId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'losantDeviceId (24 hex) required' }) };
  }

  // 3. Config.
  const apiKey = process.env.TTS_API_KEY;
  const appId = process.env.TTS_APP_ID;
  const cluster = process.env.TTS_CLUSTER || 'nam1.cloud.thethings.network';
  const freqPlan = process.env.TTS_FREQ_PLAN || 'US_902_928_FSB_2';
  const losantApp = process.env.LOSANT_APP_ID;
  const losantToken = process.env.LOSANT_COMMAND_TOKEN;
  if (!apiKey || !appId || !losantApp || !losantToken || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured (TTS/Losant/Supabase env)' }) };
  }

  // 4. Generate fresh OTAA credentials. JoinEUI = zeros (matches the firmware).
  const devEUI = hex(randomBytes(8));
  const appKey = hex(randomBytes(16));
  const joinEUI = '0000000000000000';
  const deviceId = 'gp-' + devEUI.toLowerCase();   // unique, lowercase

  // The Things Network quirk: the Identity Server (device REGISTRATION) is
  // centralized on eu1, while the device's network/join/application servers run
  // on the operating cluster (nam1). So the IS create goes to isHost; the JS/NS/AS
  // calls go to the cluster.
  const isHost = process.env.TTS_IS_HOST || 'eu1.cloud.thethings.network';
  const tts = async (host, method, path, payload) => {
    const res = await fetch(`https://${host}/api/v3/${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) console.error(`TTS ${method} ${host}/${path} -> ${res.status}: ${text}`);
    return { ok: res.ok, status: res.status, text };
  };
  const ids = { device_id: deviceId, dev_eui: devEUI, join_eui: joinEUI };

  // 4a. Identity Server: create the device registration.
  let r = await tts(isHost, 'POST', `applications/${appId}/devices`, {
    end_device: {
      ids,
      network_server_address: cluster,
      application_server_address: cluster,
      join_server_address: cluster,
    },
    field_mask: { paths: ['network_server_address', 'application_server_address', 'join_server_address'] },
  });
  if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: 'TTS Identity Server create failed', detail: r.text }) };

  // 4b. Join Server: set the root key (AppKey). Only here.
  r = await tts(cluster, 'PUT', `js/applications/${appId}/devices/${deviceId}`, {
    end_device: {
      ids,
      network_server_address: cluster,
      application_server_address: cluster,
      root_keys: { app_key: { key: appKey } },
    },
    field_mask: { paths: ['network_server_address', 'application_server_address', 'ids.device_id', 'ids.dev_eui', 'ids.join_eui', 'root_keys.app_key.key'] },
  });
  if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: 'TTS Join Server set-key failed', detail: r.text }) };

  // 4c. Network Server: MAC/PHY settings (US915 FSB2, MAC 1.0.4, OTAA).
  r = await tts(cluster, 'PUT', `ns/applications/${appId}/devices/${deviceId}`, {
    end_device: {
      ids,
      frequency_plan_id: freqPlan,
      lorawan_version: 'MAC_V1_0_4',
      lorawan_phy_version: 'RP002_V1_0_4',
      supports_join: true,
      network_server_address: cluster,
    },
    field_mask: { paths: ['frequency_plan_id', 'lorawan_version', 'lorawan_phy_version', 'supports_join'] },
  });
  if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: 'TTS Network Server settings failed', detail: r.text }) };

  // 4d. Application Server: register.
  r = await tts(cluster, 'PUT', `as/applications/${appId}/devices/${deviceId}`, {
    end_device: { ids },
    field_mask: { paths: [] },
  });
  if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: 'TTS Application Server register failed', detail: r.text }) };

  // 5. Store the route so the uplink webhook sends this device's data to the
  // board's existing Losant device (upsert on tts_device_id).
  try {
    await fetch(`${supaUrl}/rest/v1/lorawan_devices`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ tts_device_id: deviceId, dev_eui: devEUI, losant_device_id: losantDeviceId, user_id: userId }),
    });
  } catch {
    // The TTS device exists; if the route insert fails we surface it but the
    // device is registered. (Webhook also still has the static env-map fallback.)
    return { statusCode: 502, body: JSON.stringify({ error: 'Route store failed (TTS device was created)' }) };
  }

  // 6. Push the keys to the board via a Losant command, then it reboots into
  // LoRaWAN. (Delivered now if the board is online, or on its next connect.)
  try {
    await fetch(`https://api.losant.com/applications/${losantApp}/devices/${encodeURIComponent(losantDeviceId)}/command`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${losantToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'provisionLoRa', payload: { joinEUI, devEUI, appKey } }),
    });
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not send keys to the board' }) };
  }

  // Don't echo the AppKey back to the browser.
  return { statusCode: 200, body: JSON.stringify({ ok: true, ttsDeviceId: deviceId, devEUI }) };
};
