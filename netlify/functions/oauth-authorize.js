// Google Home account-linking: authorization endpoint.
// Reached at https://growthpulsecloud.com/oauth/authorize (redirect in netlify.toml).
//
// Flow:
//   1. Google opens this URL with ?client_id&redirect_uri&state&response_type=code.
//      We serve a small GrowthPulse sign-in page (GET).
//   2. The user signs in with their GrowthPulse (Supabase) email + password.
//      The page POSTs the resulting Supabase access token back here (?action=issue).
//   3. We verify that token against Supabase, mint a one-time authorization code,
//      and tell the page where to send the browser (Google's redirect_uri).
//
// Required env vars:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (already set for the app)
//   SUPABASE_SERVICE_ROLE_KEY                  (server-side inserts, bypasses RLS)
//   GOOGLE_OAUTH_CLIENT_ID                     (must match the Developer Console)

import { randomBytes } from 'node:crypto';

const GOOGLE_REDIRECT_PREFIX = 'https://oauth-redirect.googleusercontent.com/r/';

export const handler = async (event) => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientId || !supaUrl || !anonKey || !serviceKey) {
    return { statusCode: 500, body: 'Server not configured' };
  }

  const params = event.queryStringParameters || {};

  // ---- Step 3: the sign-in page posts the Supabase session back to us ----
  if (event.httpMethod === 'POST' && params.action === 'issue') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    const { supabaseAccessToken, redirect_uri: redirectUri, state } = body;
    if (!supabaseAccessToken || !redirectUri) {
      return json(400, { error: 'missing fields' });
    }
    if (!redirectUri.startsWith(GOOGLE_REDIRECT_PREFIX)) {
      return json(400, { error: 'redirect_uri not allowed' });
    }
    // Verify the Supabase session is real and get the user id.
    const userRes = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${supabaseAccessToken}` },
    });
    if (!userRes.ok) return json(401, { error: 'invalid session' });
    const user = await userRes.json();
    if (!user || !user.id) return json(401, { error: 'invalid session' });

    // One-time authorization code, 10 minute lifetime.
    const code = randomBytes(32).toString('base64url');
    const ins = await fetch(`${supaUrl}/rest/v1/google_oauth_codes`, {
      method: 'POST',
      headers: {
        ...serviceHeaders(serviceKey),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        code,
        user_id: user.id,
        redirect_uri: redirectUri,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }),
    });
    if (!ins.ok) return json(502, { error: 'could not store code' });

    const sep = redirectUri.includes('?') ? '&' : '?';
    const dest = `${redirectUri}${sep}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`;
    return json(200, { redirect: dest });
  }

  // ---- Steps 1-2: serve the sign-in page ----
  if (params.response_type !== 'code' || params.client_id !== clientId) {
    return { statusCode: 400, body: 'invalid request' };
  }
  const redirectUri = params.redirect_uri || '';
  if (!redirectUri.startsWith(GOOGLE_REDIRECT_PREFIX)) {
    return { statusCode: 400, body: 'redirect_uri not allowed' };
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Link GrowthPulse to Google Home</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; display: flex;
         min-height: 100vh; margin: 0; align-items: center; justify-content: center;
         background: #f4faf5; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.08);
          padding: 32px; width: 320px; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #1b5e20; }
  p  { font-size: 14px; color: #555; margin: 0 0 20px; }
  input { width: 100%; box-sizing: border-box; padding: 10px 12px; margin-bottom: 12px;
          border: 1px solid #ccc; border-radius: 8px; font-size: 15px; }
  button { width: 100%; padding: 11px; border: 0; border-radius: 8px; background: #2e7d32;
           color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .6; }
  .err { color: #c62828; font-size: 13px; min-height: 18px; margin: 8px 0 0; }
</style>
</head>
<body>
<div class="card">
  <h1>GrowthPulse</h1>
  <p>Sign in to connect your plants to Google Home.</p>
  <form id="f">
    <input id="email" type="email" placeholder="Email" required autocomplete="username" />
    <input id="pass" type="password" placeholder="Password" required autocomplete="current-password" />
    <button id="go" type="submit">Sign in &amp; link</button>
    <div class="err" id="err"></div>
  </form>
</div>
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const supabase = createClient(${JSON.stringify(supaUrl)}, ${JSON.stringify(anonKey)});
  const qs = new URLSearchParams(location.search);
  const f = document.getElementById('f');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('go');
    const err = document.getElementById('err');
    btn.disabled = true; err.textContent = '';
    const { data, error } = await supabase.auth.signInWithPassword({
      email: document.getElementById('email').value,
      password: document.getElementById('pass').value,
    });
    if (error || !data.session) {
      err.textContent = error ? error.message : 'Sign-in failed';
      btn.disabled = false;
      return;
    }
    const res = await fetch(location.pathname + '?action=issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabaseAccessToken: data.session.access_token,
        redirect_uri: qs.get('redirect_uri'),
        state: qs.get('state'),
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (res.ok && out.redirect) { location.href = out.redirect; }
    else { err.textContent = out.error || 'Linking failed'; btn.disabled = false; }
  });
</script>
</body>
</html>`;
  return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html };
};

const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
});

// Legacy service_role JWTs go in both headers; new sb_secret_... keys are not
// JWTs and must only be sent as apikey.
const serviceHeaders = (key) =>
  key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
