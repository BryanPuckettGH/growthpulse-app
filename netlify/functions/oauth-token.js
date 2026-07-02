// Google Home account-linking: token endpoint.
// Reached at https://growthpulsecloud.com/oauth/token (redirect in netlify.toml).
//
// Google calls this server-to-server (form-encoded POST) in two ways:
//   grant_type=authorization_code  -> exchange the one-time code for tokens
//   grant_type=refresh_token       -> mint a fresh access token
//
// Access tokens are HMAC-signed JWTs carrying the Supabase user id (1 hour).
// Refresh tokens are opaque random strings stored in google_oauth_tokens.
//
// Required env vars:
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET  (match Developer Console)
//   GH_JWT_SECRET                                       (access-token signing key)
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ACCESS_TTL_SEC = 3600;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'invalid_request' });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const jwtSecret = process.env.GH_JWT_SECRET;
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientId || !clientSecret || !jwtSecret || !supaUrl || !serviceKey) {
    return json(500, { error: 'server_error' });
  }

  const p = new URLSearchParams(event.body || '');
  if (p.get('client_id') !== clientId || !safeEqual(p.get('client_secret') || '', clientSecret)) {
    return json(401, { error: 'invalid_client' });
  }

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

  // ---- authorization_code -> access + refresh tokens ----
  if (p.get('grant_type') === 'authorization_code') {
    const code = p.get('code') || '';
    const rows = await (await rest(`google_oauth_codes?code=eq.${encodeURIComponent(code)}&select=*`)).json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || row.used || new Date(row.expires_at).getTime() < Date.now()) {
      return json(400, { error: 'invalid_grant' });
    }
    // Burn the code so it can never be replayed.
    await rest(`google_oauth_codes?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ used: true }),
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const ins = await rest('google_oauth_tokens', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ refresh_token: refreshToken, user_id: row.user_id }),
    });
    if (!ins.ok) return json(500, { error: 'server_error' });

    return json(200, {
      token_type: 'Bearer',
      access_token: signJwt({ sub: row.user_id }, jwtSecret, ACCESS_TTL_SEC),
      refresh_token: refreshToken,
      expires_in: ACCESS_TTL_SEC,
    });
  }

  // ---- refresh_token -> new access token ----
  if (p.get('grant_type') === 'refresh_token') {
    const rt = p.get('refresh_token') || '';
    const rows = await (await rest(`google_oauth_tokens?refresh_token=eq.${encodeURIComponent(rt)}&revoked=eq.false&select=user_id`)).json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return json(400, { error: 'invalid_grant' });
    return json(200, {
      token_type: 'Bearer',
      access_token: signJwt({ sub: row.user_id }, jwtSecret, ACCESS_TTL_SEC),
      expires_in: ACCESS_TTL_SEC,
    });
  }

  return json(400, { error: 'unsupported_grant_type' });
};

// -- minimal HS256 JWT (no dependencies) --
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const signJwt = (claims, secret, ttlSec) => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64u(JSON.stringify({ ...claims, iat: now, exp: now + ttlSec, iss: 'growthpulse' }));
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
};

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(obj),
});
