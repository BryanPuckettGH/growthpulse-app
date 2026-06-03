// Sends a command to a GrowthPulse unit through the device cloud.
// Used by the app's factory-reset flow: if the unit is online, it wipes its
// own Wi-Fi and reboots into setup mode for the new owner.
// Requires LOSANT_COMMAND_TOKEN (a write-capable API token) and LOSANT_APP_ID.
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only' }) };
  }
  const token = process.env.LOSANT_COMMAND_TOKEN;
  const appId = process.env.LOSANT_APP_ID;
  const params = event.queryStringParameters || {};
  const deviceId = params.deviceId;
  const name = params.name || 'factoryReset';

  if (!token || !appId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }
  if (!deviceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'deviceId required' }) };
  }
  // Only allow the commands we actually support.
  if (name !== 'factoryReset') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unsupported command' }) };
  }

  try {
    const res = await fetch(
      `https://api.losant.com/applications/${appId}/devices/${encodeURIComponent(deviceId)}/command`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, payload: {} }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: text }) };
    }
    return { statusCode: 200, body: JSON.stringify({ sent: true }) };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e) }) };
  }
};
