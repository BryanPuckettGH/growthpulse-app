// Branded "Account Data Export" document. Opens print-ready in a new tab,
// where Save as PDF produces the customer-facing export. A machine-readable
// JSON download exists separately for data portability.
import { METRICS, PLANTS, TRANSPORTS, powerInfo, timeAgo } from '../store/helpers';
import { TIERS } from '../store/tiers';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function openAccountExport({ user, devices, gateways = [], alarmRules = [], settings, journals = {}, tierId }) {
  const now = new Date();
  const tier = TIERS[tierId] || TIERS.free;

  const deviceRows = devices.map((d) => {
    const plant = PLANTS[d.plant] || PLANTS.generic;
    const t = TRANSPORTS[d.transport] || TRANSPORTS.wifi;
    const p = powerInfo(d.reading);
    const power = p.mode === 'ac' ? 'AC power' : `Battery ${p.pct}%`;
    const status = d.online ? 'Online' : d.hasData ? `Offline (last seen ${timeAgo(d.lastSeen)})` : 'Never connected';
    return `<tr>
      <td><b>${esc(d.name)}</b></td>
      <td>${plant.emoji} ${esc(plant.name)}</td>
      <td>${esc(d.group || '')}</td>
      <td>${esc(d.location || '')}</td>
      <td>${t.label}</td>
      <td>${power}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');

  const gatewayRows = gateways.map((g) => `<tr>
      <td><b>${esc(g.name)}</b></td>
      <td>${esc(g.code)}</td>
      <td>${g.addedAt ? new Date(g.addedAt).toLocaleDateString() : ''}</td>
    </tr>`).join('');

  const deviceName = (id) => {
    if (id === 'all' || !id) return 'All plants';
    const d = devices.find((x) => x.id === id);
    return d ? d.name : 'Removed plant';
  };
  const alarmRows = alarmRules.map((r) => {
    const m = METRICS[r.metric] || { label: r.metric, unit: '' };
    return `<tr>
      <td>${esc(m.label)}</td>
      <td>${r.op === 'below' ? 'Below' : 'Above'} ${r.value}${m.unit}</td>
      <td>${esc(deviceName(r.deviceId))}</td>
      <td>${r.enabled ? 'On' : 'Off'}</td>
    </tr>`;
  }).join('');

  const n = settings.notifications || {};
  const notif = [
    n.push ? 'Push' : null,
    n.email ? `Email (${esc(n.emailAddr || 'no address set')})` : null,
    n.sms ? `SMS (${esc(n.phone || 'no number set')})` : null,
  ].filter(Boolean).join(' · ') || 'None enabled';

  const journalBlocks = devices.map((d) => {
    const entries = journals[d.id] || [];
    if (entries.length === 0) return '';
    const items = entries.slice(0, 4).map((e) => `
        <div class="entry">
          <div class="edate">${new Date(e.date).toLocaleDateString()}</div>
          ${e.photo ? `<img src="${e.photo}" alt=""/>` : ''}
          <div>${esc(e.note || e.text || '')}</div>
        </div>`).join('');
    const more = entries.length > 4 ? `<div class="muted-sm">+ ${entries.length - 4} more entries</div>` : '';
    return `<h3>${esc(d.name)} (${entries.length} entr${entries.length === 1 ? 'y' : 'ies'})</h3>${items}${more}`;
  }).join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>GrowthPulse Account Export · ${esc(user.name)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2c3e50; margin: 36px; }
  .brand b { font-size: 26px; letter-spacing: -0.5px; }
  .brand b span { color: #2ecc71; font-weight: 400; }
  .tag { font-size: 10px; letter-spacing: 2.5px; color: #8a94a0; margin-top: 2px; }
  .docline { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #2ecc71; padding-bottom: 10px; margin-top: 22px; }
  .docline h1 { font-size: 19px; margin: 0; }
  .docline span { font-size: 12px; color: #6b7280; }
  .meta { display: flex; gap: 36px; flex-wrap: wrap; margin: 16px 0 6px; }
  .meta div { font-size: 13px; }
  .meta .l { font-size: 10.5px; color: #8a94a0; text-transform: uppercase; letter-spacing: 0.6px; }
  .meta .v { font-weight: 700; margin-top: 2px; }
  h2 { font-size: 14px; margin: 24px 0 8px; color: #1a9b5a; }
  h3 { font-size: 12.5px; margin: 14px 0 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e8ebee; font-size: 12.5px; }
  th { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #8a94a0; }
  .entry { border: 1px solid #e8ebee; border-radius: 10px; padding: 9px 12px; margin-bottom: 7px; font-size: 12.5px; page-break-inside: avoid; }
  .edate { font-size: 10.5px; color: #8a94a0; margin-bottom: 3px; }
  .entry img { max-width: 160px; border-radius: 8px; display: block; margin: 5px 0; }
  .muted-sm { font-size: 11.5px; color: #8a94a0; margin: 4px 0 8px; }
  .none { font-size: 12.5px; color: #8a94a0; }
  .foot { margin-top: 30px; font-size: 10.5px; color: #9aa1aa; border-top: 1px solid #e8ebee; padding-top: 10px; line-height: 1.6; }
</style></head>
<body>
  <div class="brand"><b>Growth<span>Pulse</span></b></div>
  <div class="tag">SMART PLANT MONITORING</div>

  <div class="docline">
    <h1>Account Data Export</h1>
    <span>Generated ${now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
  </div>

  <div class="meta">
    <div><div class="l">Account holder</div><div class="v">${esc(user.name)}</div></div>
    <div><div class="l">Email</div><div class="v">${esc(user.email)}</div></div>
    <div><div class="l">Grower type</div><div class="v">${esc(user.growerType || 'Not set')}</div></div>
    <div><div class="l">Plan</div><div class="v">${esc(tier.name)} ${esc(tier.price)}${esc(tier.period)}</div></div>
  </div>

  <h2>Devices (${devices.length})</h2>
  ${devices.length ? `<table>
    <tr><th>Plant</th><th>Type</th><th>Group</th><th>Home location</th><th>Connection</th><th>Power</th><th>Status</th></tr>
    ${deviceRows}
  </table>` : '<div class="none">No devices on this account.</div>'}

  <h2>Gateways (${gateways.length})</h2>
  ${gateways.length ? `<table>
    <tr><th>Name</th><th>Code</th><th>Added</th></tr>
    ${gatewayRows}
  </table>` : '<div class="none">No gateways on this account.</div>'}

  <h2>Alarm rules (${alarmRules.length})</h2>
  ${alarmRules.length ? `<table>
    <tr><th>Sensor</th><th>Condition</th><th>Applies to</th><th>Enabled</th></tr>
    ${alarmRows}
  </table>` : '<div class="none">No alarm rules configured.</div>'}

  <h2>Preferences</h2>
  <table>
    <tr><th>Setting</th><th>Value</th></tr>
    <tr><td>Temperature units</td><td>°${esc(settings.units)}</td></tr>
    <tr><td>Theme</td><td>${esc(settings.theme)}</td></tr>
    <tr><td>Refresh rate</td><td>${settings.refreshMs >= 60000 ? `${settings.refreshMs / 60000} min` : `${settings.refreshMs / 1000}s`}</td></tr>
    <tr><td>Notifications</td><td>${notif}</td></tr>
  </table>

  ${journalBlocks ? `<h2>Growth journals</h2>${journalBlocks}` : ''}

  <div class="foot">
    This document summarizes all data stored for your GrowthPulse account at the time of generation.
    A machine-readable copy of the same data is available from Settings.
    GrowthPulse · Smart Plant Monitoring · growthpulsecloud.com · FIU Senior Design
  </div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 350); };</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
