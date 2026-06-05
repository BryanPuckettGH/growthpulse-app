// Server-side PDF rendering. The browser POSTs the finished report HTML; we
// run it through a headless Chrome (Lambda build) and return a true vector
// PDF — crisp selectable text, no rasterization.
//
// Auth-gated so this can't be used as an open PDF service: the caller must
// send a valid Supabase session token. We don't trust the HTML to name a
// device; we only confirm the caller is a signed-in user of this app.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only' }) };
  }

  // Require a signed-in user (verify the token against Supabase's auth API).
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (supaUrl && supaKey) {
    const auth = event.headers.authorization || event.headers.Authorization;
    if (!auth) return { statusCode: 401, body: JSON.stringify({ error: 'Sign in required' }) };
    try {
      const who = await fetch(`${supaUrl}/auth/v1/user`, { headers: { apikey: supaKey, Authorization: auth } });
      if (!who.ok) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };
    } catch {
      return { statusCode: 502, body: JSON.stringify({ error: 'Auth check failed' }) };
    }
  }

  let html; let filename;
  try {
    const data = JSON.parse(event.body || '{}');
    html = data.html;
    filename = (data.filename || 'GrowthPulse Report').replace(/[^\w .-]/g, '').slice(0, 80) || 'GrowthPulse Report';
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }
  if (!html || typeof html !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'html required' }) };
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1100, height: 1400, deviceScaleFactor: 2 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '0.4in', bottom: '0.5in', left: '0.4in', right: '0.4in' },
    });

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        'Cache-Control': 'no-store',
      },
      body: Buffer.from(pdf).toString('base64'),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e && e.message || e) }) };
  } finally {
    if (browser) await browser.close();
  }
};
