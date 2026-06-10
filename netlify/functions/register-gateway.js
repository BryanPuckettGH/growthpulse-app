// Auto-register a LoRaWAN gateway on The Things Stack (under the GrowthPulse
// network) when a customer adds/scans it in the app. The app POSTs the gateway
// EUI + name with the signed-in user's Supabase session token; we validate the
// session, then create the gateway via the TTS API so the customer never has to
// touch The Things Stack themselves.
//
// IMPORTANT: this registers the gateway *entity* on TTS and ties it to your
// network. The gateway hardware must still be pre-configured (before shipping)
// to forward to your TTS server (Packet Forwarder -> nam1.cloud.thethings.network
// :1700, US915 FSB2). The app can't reach inside the gateway to set that.
//
// Env vars (Netlify):
//   TTS_API_KEY        a TTS personal/org API key with gateway-create rights
//   TTS_USER_ID        the TTS account/org username that should own the gateways
//   TTS_CLUSTER        host, e.g. nam1.cloud.thethings.network   (default nam1)
//   TTS_FREQ_PLAN      e.g. US_902_928_FSB_2                       (default FSB2)
//   VITE_SUPABASE_URL  existing (used to validate the caller's session)
//   VITE_SUPABASE_ANON_KEY existing

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only' }) };
  }

  // 1. Validate the signed-in user (only a logged-in account can register one).
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
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

  // 2. Parse + validate the gateway EUI.
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  const eui = String(body.eui || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (eui.length !== 16) {
    return { statusCode: 400, body: JSON.stringify({ error: 'EUI must be 16 hex digits' }) };
  }
  const name = String(body.name || 'GrowthPulse Gateway').slice(0, 50);

  // 3. Register the gateway on The Things Stack.
  const apiKey = process.env.TTS_API_KEY;
  const userId = process.env.TTS_USER_ID;
  const cluster = process.env.TTS_CLUSTER || 'nam1.cloud.thethings.network';
  const freqPlan = process.env.TTS_FREQ_PLAN || 'US_902_928_FSB_2';
  if (!apiKey || !userId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured for TTS' }) };
  }

  const gatewayId = 'eui-' + eui.toLowerCase();
  try {
    const res = await fetch(`https://${cluster}/api/v3/users/${encodeURIComponent(userId)}/gateways`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateway: {
          ids: { gateway_id: gatewayId, eui },
          name,
          frequency_plan_id: freqPlan,
          gateway_server_address: cluster,
          // Semtech UDP packet forwarder (what the ThinkNode G1 uses) is unauthenticated.
          require_authenticated_connection: false,
          status_public: true,
          location_public: true,
        },
      }),
    });
    // Already registered (e.g. re-scan) is a success from the user's point of view.
    if (res.status === 409) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, already: true, gatewayId }) };
    }
    if (!res.ok) {
      const detail = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'TTS rejected gateway', detail }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, gatewayId }) };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
