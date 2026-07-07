// One-off backfill: adds the water-meter attributes (firmware 5.1+) to every
// EXISTING device in the Losant application. New devices get them automatically
// from provision-device.js; Losant silently drops state for attributes a
// device doesn't have, so already-provisioned units need this once or their
// water data never lands.
//
// Usage (Node 18+):
//   LOSANT_API_TOKEN=xxx LOSANT_APP_ID=yyy node scripts/add-water-attributes.mjs
//
// The token needs devices.get + devices.patch. Your Netlify
// LOSANT_PROVISION_API_TOKEN or LOSANT_COMMAND_TOKEN typically works.
// Safe to re-run: existing attributes are kept, missing ones appended.

const token = process.env.LOSANT_API_TOKEN || process.env.LOSANT_COMMAND_TOKEN;
const appId = process.env.LOSANT_APP_ID;
if (!token || !appId) {
  console.error('Set LOSANT_API_TOKEN (or LOSANT_COMMAND_TOKEN) and LOSANT_APP_ID.');
  process.exit(1);
}

const NEW_ATTRS = [
  { name: 'flowLpm', dataType: 'number' },
  { name: 'waterSessionL', dataType: 'number' },
  { name: 'waterTotalL', dataType: 'number' },
  { name: 'valveOpen', dataType: 'boolean' },
  { name: 'flowFault', dataType: 'boolean' },
  { name: 'leakDetected', dataType: 'boolean' },
];

const api = (path, opts = {}) =>
  fetch(`https://api.losant.com/applications/${appId}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });

const list = await api('/devices?perPage=1000');
if (!list.ok) {
  console.error('Could not list devices:', list.status, await list.text());
  process.exit(1);
}
const { items = [] } = await list.json();
console.log(`Found ${items.length} device(s) in application ${appId}.`);

for (const dev of items) {
  const have = new Set((dev.attributes || []).map((a) => a.name));
  const missing = NEW_ATTRS.filter((a) => !have.has(a.name));
  if (missing.length === 0) {
    console.log(`  ${dev.name} (${dev.deviceId}): already up to date`);
    continue;
  }
  const attributes = [...(dev.attributes || []), ...missing];
  const res = await api(`/devices/${dev.deviceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ attributes }),
  });
  if (res.ok) {
    console.log(`  ${dev.name} (${dev.deviceId}): added ${missing.map((a) => a.name).join(', ')}`);
  } else {
    console.error(`  ${dev.name} (${dev.deviceId}): FAILED -> ${res.status} ${await res.text()}`);
  }
}
console.log('Done.');
