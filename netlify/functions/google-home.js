// Google Home fulfillment webhook.
// Reached at https://growthpulsecloud.com/api/google-home (redirect in netlify.toml).
//
// Google sends smart home intents here with the access token minted by
// oauth-token.js. Each GrowthPulse node appears in Google Home as two devices:
//   <uuid>:sensor  SENSOR    soil temperature (TemperatureControl, query only)
//                            + soil moisture (HumiditySetting, query only)
//   <uuid>:valve   SPRINKLER StartStop + Timer ("run for 10 seconds")
//
// Readings come from Losant compositeState (same source as device-state.js).
// Valve commands go through the Losant command API (same as device-command.js)
// as setValve { open, durationSeconds }. Firmware auto-closes after the
// duration as a failsafe. Valve run state is mirrored in google_valve_runs so
// QUERY can answer "is the water on?" without waiting for the device.
//
// Required env vars:
//   GH_JWT_SECRET, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   LOSANT_API_TOKEN, LOSANT_COMMAND_TOKEN, LOSANT_APP_ID

import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_RUN_SEC = 60;   // "turn on the water" with no duration
const MAX_RUN_SEC = 600;      // hard cap

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, {});

  const jwtSecret = process.env.GH_JWT_SECRET;
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!jwtSecret || !supaUrl || !serviceKey) return json(500, {});

  // ---- authenticate Google's request (our own access JWT) ----
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const userId = verifyJwt(auth.replace(/^Bearer\s+/i, ''), jwtSecret);
  if (!userId) return json(401, { error: 'invalid token' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, {}); }
  const requestId = body.requestId;
  const input = (body.inputs && body.inputs[0]) || {};

  // Legacy service_role JWTs go in both headers; new sb_secret_... keys are
  // not JWTs and must only be sent as apikey.
  const svc = serviceKey.startsWith('sb_')
    ? { apikey: serviceKey }
    : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const rest = (path, opts = {}) =>
    fetch(`${supaUrl}/rest/v1/${path}`, {
      ...opts,
      headers: { ...svc, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });

  // ---------------- SYNC ----------------
  if (input.intent === 'action.devices.SYNC') {
    const rows = await (await rest(
      `devices?user_id=eq.${userId}&select=id,name,location,losant_device_id&losant_device_id=not.is.null`
    )).json();
    const devices = [];
    for (const d of Array.isArray(rows) ? rows : []) {
      devices.push({
        id: `${d.id}:sensor`,
        type: 'action.devices.types.SENSOR',
        traits: [
          'action.devices.traits.TemperatureControl',
          'action.devices.traits.HumiditySetting',
        ],
        name: { name: d.name || 'Plant sensor' },
        willReportState: false,
        roomHint: d.location || undefined,
        attributes: {
          queryOnlyTemperatureControl: true,
          temperatureUnitForUX: 'F',
          temperatureRange: { minThresholdCelsius: -20, maxThresholdCelsius: 60 },
          queryOnlyHumiditySetting: true,
        },
      });
      devices.push({
        id: `${d.id}:air`,
        type: 'action.devices.types.SENSOR',
        traits: [
          'action.devices.traits.TemperatureControl',
          'action.devices.traits.HumiditySetting',
        ],
        name: { name: `${d.name || 'Plant'} air` },
        willReportState: false,
        roomHint: d.location || undefined,
        attributes: {
          queryOnlyTemperatureControl: true,
          temperatureUnitForUX: 'F',
          temperatureRange: { minThresholdCelsius: -20, maxThresholdCelsius: 60 },
          queryOnlyHumiditySetting: true,
        },
      });
      devices.push({
        id: `${d.id}:valve`,
        type: 'action.devices.types.SPRINKLER',
        traits: ['action.devices.traits.StartStop', 'action.devices.traits.Timer'],
        name: {
          name: `${d.name || 'Plant'} water`,
          nicknames: [`${d.name || 'Plant'} sprinkler`],
        },
        willReportState: false,
        roomHint: d.location || undefined,
        attributes: {
          pausable: false,
          maxTimerLimitSec: MAX_RUN_SEC,
          commandOnlyTimer: false,
        },
      });
    }
    return json(200, { requestId, payload: { agentUserId: userId, devices } });
  }

  // ---------------- QUERY ----------------
  if (input.intent === 'action.devices.QUERY') {
    const asked = (input.payload && input.payload.devices) || [];
    const states = {};
    await Promise.all(asked.map(async ({ id }) => {
      const [rowId, kind] = String(id).split(':');
      const dev = await ownedDevice(rest, userId, rowId);
      if (!dev) { states[id] = { online: false, status: 'ERROR', errorCode: 'deviceNotFound' }; return; }

      if (kind === 'sensor' || kind === 'air') {
        const s = await losantState(dev.losant_device_id);
        if (!s) { states[id] = { online: false, status: 'OFFLINE' }; return; }
        // :sensor = soil probe (moisture rides on the humidity trait);
        // :air = DHT22 air temperature + true relative humidity.
        const tempF = kind === 'air' ? s.airTemperatureF : s.soilTemperatureF;
        const hum = kind === 'air' ? s.airHumidity : s.soilMoisturePercent;
        states[id] = {
          online: true,
          status: 'SUCCESS',
          temperatureAmbientCelsius: fToC(tempF),
          temperatureSetpointCelsius: fToC(tempF),
          humidityAmbientPercent: hum != null ? Math.round(hum) : undefined,
        };
      } else {
        // Valve: report from the mirrored run record.
        const runs = await (await rest(`google_valve_runs?device_id=eq.${rowId}&select=until_ts`)).json();
        const until = runs && runs[0] ? new Date(runs[0].until_ts).getTime() : 0;
        const remaining = Math.max(0, Math.round((until - Date.now()) / 1000));
        states[id] = {
          online: true,
          status: 'SUCCESS',
          isRunning: remaining > 0,
          isPaused: false,
          timerRemainingSec: remaining > 0 ? remaining : -1,
        };
      }
    }));
    return json(200, { requestId, payload: { devices: states } });
  }

  // ---------------- EXECUTE ----------------
  if (input.intent === 'action.devices.EXECUTE') {
    const results = [];
    for (const group of (input.payload && input.payload.commands) || []) {
      for (const dev of group.devices || []) {
        const [rowId, kind] = String(dev.id).split(':');
        const owned = kind === 'valve' ? await ownedDevice(rest, userId, rowId) : null;
        if (!owned) {
          results.push({ ids: [dev.id], status: 'ERROR', errorCode: 'deviceNotFound' });
          continue;
        }
        for (const ex of group.execution || []) {
          let open = null;
          let durationSec = DEFAULT_RUN_SEC;
          if (ex.command === 'action.devices.commands.StartStop') {
            open = !!ex.params.start;
          } else if (ex.command === 'action.devices.commands.TimerStart') {
            open = true;
            durationSec = Math.min(MAX_RUN_SEC, Math.max(1, ex.params.timerTimeSec | 0));
          } else if (ex.command === 'action.devices.commands.TimerCancel') {
            open = false;
          }
          if (open === null) {
            results.push({ ids: [dev.id], status: 'ERROR', errorCode: 'functionNotSupported' });
            continue;
          }
          const ok = await losantCommand(owned.losant_device_id, open, durationSec);
          if (ok) {
            const until = new Date(Date.now() + (open ? durationSec * 1000 : 0)).toISOString();
            await rest(`google_valve_runs?on_conflict=device_id`, {
              method: 'POST',
              headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify({ device_id: rowId, until_ts: until }),
            });
          }
          results.push(ok
            ? {
                ids: [dev.id],
                status: 'SUCCESS',
                states: { online: true, isRunning: open, timerRemainingSec: open ? durationSec : -1 },
              }
            : { ids: [dev.id], status: 'ERROR', errorCode: 'transientError' });
        }
      }
    }
    return json(200, { requestId, payload: { commands: results } });
  }

  // ---------------- DISCONNECT ----------------
  if (input.intent === 'action.devices.DISCONNECT') {
    await rest(`google_oauth_tokens?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ revoked: true }),
    });
    return json(200, {});
  }

  return json(400, { requestId, payload: { errorCode: 'notSupported' } });
};

// ---- helpers ----

// Ownership check: the device row must belong to the token's user.
const ownedDevice = async (rest, userId, rowId) => {
  if (!/^[0-9a-f-]{36}$/i.test(rowId || '')) return null;
  const rows = await (await rest(
    `devices?id=eq.${rowId}&user_id=eq.${userId}&select=id,losant_device_id`
  )).json();
  return Array.isArray(rows) && rows[0] && rows[0].losant_device_id ? rows[0] : null;
};

const losantState = async (deviceId) => {
  const token = process.env.LOSANT_API_TOKEN;
  const appId = process.env.LOSANT_APP_ID;
  if (!token || !appId) return null;
  try {
    const res = await fetch(
      `https://api.losant.com/applications/${appId}/devices/${deviceId}/compositeState`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const s = await res.json();
    const num = (k) => (s[k] && typeof s[k].value === 'number' ? s[k].value : null);
    return {
      soilTemperatureF: num('soilTemperatureF'),
      soilMoisturePercent: num('soilMoisturePercent'),
      airTemperatureF: num('airTemperatureF'),
      airHumidity: num('airHumidity'),
    };
  } catch { return null; }
};

const losantCommand = async (deviceId, open, durationSeconds) => {
  const token = process.env.LOSANT_COMMAND_TOKEN;
  const appId = process.env.LOSANT_APP_ID;
  if (!token || !appId) return false;
  try {
    const res = await fetch(
      `https://api.losant.com/applications/${appId}/devices/${encodeURIComponent(deviceId)}/command`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'setValve', payload: { open, durationSeconds } }),
      }
    );
    return res.ok;
  } catch { return false; }
};

const fToC = (f) => (typeof f === 'number' ? Math.round(((f - 32) * 5) / 9 * 10) / 10 : undefined);

const verifyJwt = (token, secret) => {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload.sub || null;
  } catch { return null; }
};

const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
});
