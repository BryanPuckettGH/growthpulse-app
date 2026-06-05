// The full GrowthPulse plant report. Opens print-ready in a new tab, where
// Save as PDF produces the customer-facing document: branded letterhead,
// per-plant sensor graphs over the chosen period, an activity timeline,
// and the account summary tables.
//
// The caller (ExportSheet) decides the period, which plants and which
// sensors, fetches each plant's history from the cloud, and hands it all in
// via `report`:
//   report = {
//     rangeLabel: 'Last 7 days',
//     start, end,                 // ms epoch
//     metrics: ['airTemperatureF', ...],          // selected sensors
//     histories: { [deviceId]: [{ t, airTemperatureF, ... }, ...] },
//   }
import { METRICS, METRIC_ORDER, PLANTS, TRANSPORTS, powerInfo, timeAgo, rangesForDevice } from '../store/helpers';
import { TIERS } from '../store/tiers';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (ms) => new Date(ms).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
const fmtDateTime = (ms) => new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/* ---------- inline SVG line chart (no libraries in the print tab) ---------- */
function chartSvg(points, metricKey, band) {
  const m = METRICS[metricKey];
  const vals = points.map((p) => p[metricKey]).filter((v) => v != null);
  if (vals.length === 0) return null;

  const W = 760; const H = 190;
  const L = 48; const R = 14; const T = 12; const B = 26; // padding
  const iw = W - L - R; const ih = H - T - B;

  // Y domain: the data, padded, gently widened toward the ideal band so the
  // green zone stays visible for context.
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (band) { lo = Math.min(lo, band[0]); hi = Math.max(hi, band[1]); }
  const pad = Math.max((hi - lo) * 0.12, 1);
  lo -= pad; hi += pad;

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = Math.max(t1 - t0, 1);
  const X = (t) => L + ((t - t0) / span) * iw;
  const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * ih;

  // Ideal band shading
  let bandRect = '';
  if (band) {
    const y1 = Math.max(T, Math.min(Y(band[1]), T + ih));
    const y2 = Math.max(T, Math.min(Y(band[0]), T + ih));
    if (y2 > y1) bandRect = `<rect x="${L}" y="${y1.toFixed(1)}" width="${iw}" height="${(y2 - y1).toFixed(1)}" fill="#2ecc71" opacity="0.09"/>`;
  }

  // Gridlines + y labels
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    const y = Y(v).toFixed(1);
    grid += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#edf0f3" stroke-width="1"/>` +
      `<text x="${L - 7}" y="${y}" font-size="9.5" fill="#9aa1aa" text-anchor="end" dominant-baseline="middle">${(+v.toFixed(1))}${m.unit}</text>`;
  }

  // X labels: 4 evenly spaced; show times for short spans, dates for long.
  const short = span < 2 * 86400000;
  let xlabels = '';
  for (let i = 0; i <= 3; i++) {
    const t = t0 + (span * i) / 3;
    const anchor = i === 0 ? 'start' : i === 3 ? 'end' : 'middle';
    const label = short
      ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
    xlabels += `<text x="${X(t).toFixed(1)}" y="${H - 7}" font-size="9.5" fill="#9aa1aa" text-anchor="${anchor}">${label}</text>`;
  }

  // The line, split into segments at gaps (nulls = offline stretches), plus a
  // soft area fill under each segment.
  let lines = '';
  let areas = '';
  let seg = [];
  const flush = () => {
    if (seg.length === 0) return;
    if (seg.length === 1) {
      const [p] = seg;
      lines += `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p[metricKey]).toFixed(1)}" r="2.4" fill="${m.color}"/>`;
    } else {
      const pts = seg.map((p) => `${X(p.t).toFixed(1)},${Y(p[metricKey]).toFixed(1)}`).join(' ');
      const first = seg[0]; const last = seg[seg.length - 1];
      areas += `<polygon points="${X(first.t).toFixed(1)},${(T + ih).toFixed(1)} ${pts} ${X(last.t).toFixed(1)},${(T + ih).toFixed(1)}" fill="${m.color}" opacity="0.08"/>`;
      lines += `<polyline points="${pts}" fill="none" stroke="${m.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    seg = [];
  };
  for (const p of points) {
    if (p[metricKey] == null) flush();
    else seg.push(p);
  }
  flush();

  // Dot on the latest reading
  let lastDot = '';
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i][metricKey] != null) {
      lastDot = `<circle cx="${X(points[i].t).toFixed(1)}" cy="${Y(points[i][metricKey]).toFixed(1)}" r="3.4" fill="${m.color}" stroke="#fff" stroke-width="1.5"/>`;
      break;
    }
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);

  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    ${bandRect}${grid}${areas}${lines}${lastDot}
    <line x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}" stroke="#dfe3e8" stroke-width="1"/>
    ${xlabels}
  </svg>`;

  return { svg, min: +min.toFixed(1), max: +max.toFixed(1), avg, count: vals.length };
}

/* ---------- the document ---------- */
export function openAccountExport({ user, devices, gateways = [], alarmRules = [], settings, journals = {}, tierId, report = null }) {
  const now = new Date();
  const tier = TIERS[tierId] || TIERS.free;
  const metrics = (report && report.metrics && report.metrics.length ? report.metrics : METRIC_ORDER)
    .filter((k) => METRIC_ORDER.includes(k));

  /* --- per-plant sections with graphs --- */
  const plantSections = !report ? '' : devices.map((d) => {
    const plant = PLANTS[d.plant] || PLANTS.generic;
    const t = TRANSPORTS[d.transport] || TRANSPORTS.wifi;
    const p = powerInfo(d.reading);
    const power = p.mode === 'ac' ? 'AC power' : `Battery ${p.pct}%${p.charging ? ' (charging)' : ''}`;
    const status = d.online ? 'Online' : d.hasData ? `Offline · last seen ${timeAgo(d.lastSeen)}` : 'Never connected';
    const ranges = rangesForDevice(d);
    const history = report.histories[d.id] || [];

    const facts = [
      `${plant.emoji} ${esc(plant.name)}`,
      d.location ? esc(d.location) : null,
      d.group ? esc(d.group) : null,
      t.label,
      power,
      status,
      d.claimedAt ? `Added ${fmtDate(d.claimedAt)}` : null,
    ].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

    let charts = '';
    if (history.length === 0) {
      charts = `<div class="none" style="margin:6px 0 4px">No sensor data recorded in this period. ${d.hasData ? 'The device may have been offline.' : 'This plant has not connected to the cloud yet.'}</div>`;
    } else {
      charts = metrics.map((key) => {
        const m = METRICS[key];
        const band = ranges[key] && ranges[key].good;
        const c = chartSvg(history, key, band);
        if (!c) {
          return `<div class="chartcard"><div class="chead"><span class="cdot" style="background:${m.color}"></span><b>${m.label}</b><span class="cstat">sensor not connected in this period</span></div></div>`;
        }
        return `<div class="chartcard">
          <div class="chead">
            <span class="cdot" style="background:${m.color}"></span><b>${m.label}</b>
            <span class="cstat">Min <b>${c.min}${m.unit}</b> · Avg <b>${c.avg}${m.unit}</b> · Max <b>${c.max}${m.unit}</b> · ${c.count} readings</span>
          </div>
          ${c.svg}
          ${band ? `<div class="bandnote">Shaded zone = ideal range for ${esc(plant.name)} (${band[0]}–${band[1]}${m.unit})</div>` : ''}
        </div>`;
      }).join('');
    }

    return `<div class="plant">
      <h2 class="plant__name">${esc(d.name)}</h2>
      <div class="plant__facts">${facts}</div>
      ${charts}
    </div>`;
  }).join('');

  /* --- activity timeline --- */
  let timelineHtml = '';
  if (report) {
    const events = [];
    for (const d of devices) {
      if (d.claimedAt) events.push({ t: d.claimedAt, icon: '🌱', text: `<b>${esc(d.name)}</b> was added to this account.` });
      const hist = report.histories[d.id] || [];
      const first = hist.find((p) => METRIC_ORDER.some((k) => p[k] != null));
      if (first) events.push({ t: first.t, icon: '📡', text: `First sensor data from <b>${esc(d.name)}</b> in this report period.` });
      for (const e of (journals[d.id] || [])) {
        const ts = new Date(e.date).getTime();
        if (Number.isFinite(ts)) events.push({ t: ts, icon: '📓', text: `Journal · <b>${esc(d.name)}</b>: ${esc(e.note || e.text || 'photo entry')}` });
      }
    }
    events.push({ t: now.getTime(), icon: '📄', text: 'This report was generated.' });
    events.sort((a, b) => a.t - b.t);
    timelineHtml = `<h2>Activity timeline</h2>
    <div class="tl">${events.map((e) => `
      <div class="tl__row">
        <div class="tl__date">${fmtDateTime(e.t)}</div>
        <div class="tl__dot">${e.icon}</div>
        <div class="tl__text">${e.text}</div>
      </div>`).join('')}
    </div>`;
  }

  /* --- summary tables (unchanged content) --- */
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

  const title = report ? 'Plant Data Report' : 'Account Data Export';
  const periodMeta = report
    ? `<div><div class="l">Report period</div><div class="v">${esc(report.rangeLabel)}</div></div>
       <div><div class="l">From</div><div class="v">${fmtDate(report.start)}</div></div>
       <div><div class="l">To</div><div class="v">${fmtDate(report.end)}</div></div>`
    : '';

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>GrowthPulse ${title} · ${esc(user.name)}</title>
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
  h2 { font-size: 14px; margin: 26px 0 8px; color: #1a9b5a; }
  h3 { font-size: 12.5px; margin: 14px 0 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e8ebee; font-size: 12.5px; }
  th { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #8a94a0; }
  .plant { page-break-before: auto; margin-top: 8px; }
  .plant__name { font-size: 16px; color: #2c3e50; margin: 26px 0 2px; border: 0; }
  .plant__facts { font-size: 11.5px; color: #6b7280; margin-bottom: 10px; }
  .chartcard { border: 1px solid #e8ebee; border-radius: 12px; padding: 10px 12px 8px; margin-bottom: 10px; page-break-inside: avoid; }
  .chead { display: flex; align-items: center; gap: 8px; font-size: 12.5px; margin-bottom: 4px; }
  .chead .cstat { margin-left: auto; font-size: 11px; color: #6b7280; font-weight: 400; }
  .cdot { width: 9px; height: 9px; border-radius: 99px; display: inline-block; }
  .bandnote { font-size: 10px; color: #9aa1aa; margin-top: 3px; }
  .tl { border-left: 2px solid #e8ebee; margin: 6px 0 4px 64px; padding: 2px 0; }
  .tl__row { display: flex; align-items: baseline; gap: 10px; margin: 9px 0; page-break-inside: avoid; }
  .tl__date { width: 108px; margin-left: -124px; text-align: right; font-size: 10.5px; color: #8a94a0; flex-shrink: 0; }
  .tl__dot { margin-left: -9px; font-size: 11px; background: #fff; flex-shrink: 0; }
  .tl__text { font-size: 12.5px; }
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
    <h1>${title}</h1>
    <span>Generated ${now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
  </div>

  <div class="meta">
    <div><div class="l">Account holder</div><div class="v">${esc(user.name)}</div></div>
    <div><div class="l">Email</div><div class="v">${esc(user.email)}</div></div>
    <div><div class="l">Plan</div><div class="v">${esc(tier.name)} ${esc(tier.price)}${esc(tier.period)}</div></div>
    ${periodMeta}
  </div>

  ${plantSections}

  ${timelineHtml}

  <h2>Devices in this report (${devices.length})</h2>
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
    ${report ? `Sensor graphs cover ${esc(report.rangeLabel.toLowerCase())} and are averaged into chart buckets; gaps mean the device was offline.` : ''}
    This document was generated from the data stored for your GrowthPulse account.
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
