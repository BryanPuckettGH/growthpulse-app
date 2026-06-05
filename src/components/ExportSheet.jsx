// The "Download report" options sheet. The customer picks the time period
// (presets, a custom from/to, or everything since their plants joined),
// which plants to include, and which sensors — then we pull each plant's
// full history from the cloud and open the print-ready PDF report.
import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { METRICS, METRIC_ORDER, clamp } from '../store/helpers';
import { openAccountExport, downloadAccountPdf } from '../utils/accountExport';
import { X, FileDown, Printer, Check } from 'lucide-react';

const DAY = 86400000;

const RANGES = [
  { id: '24h', label: 'Last 24 hours', ms: DAY },
  { id: '7d', label: 'Last 7 days', ms: 7 * DAY },
  { id: '30d', label: 'Last 30 days', ms: 30 * DAY },
  { id: 'all', label: 'Everything', ms: null },
  { id: 'custom', label: 'Custom dates', ms: null },
];

// Demo accounts have no cloud history, so their report charts are generated
// locally — same shape the real time-series endpoint returns.
function mockHistory(start, end) {
  const n = Math.min(240, Math.max(24, Math.round((end - start) / (15 * 60000))));
  const step = (end - start) / n;
  const v = {};
  for (const k of METRIC_ORDER) {
    const m = METRICS[k];
    v[k] = (m.good[0] + m.good[1]) / 2;
  }
  const points = [];
  for (let i = 0; i <= n; i++) {
    const p = { t: Math.round(start + i * step) };
    for (const k of METRIC_ORDER) {
      const m = METRICS[k];
      const amp = (m.good[1] - m.good[0]) * 0.35;
      v[k] = clamp(v[k] + (Math.random() - 0.5) * amp, m.min, m.max);
      p[k] = +v[k].toFixed(1);
    }
    points.push(p);
  }
  return points;
}

function CheckRow({ checked, onToggle, children, color }) {
  return (
    <button type="button" className="exp-check" onClick={onToggle} aria-pressed={checked}>
      <span className={`exp-box${checked ? ' on' : ''}`} style={checked && color ? { background: color, borderColor: color } : undefined}>
        {checked && <Check size={12} strokeWidth={3.5} />}
      </span>
      <span>{children}</span>
    </button>
  );
}

export default function ExportSheet({ onClose }) {
  const { user, devices, gateways, alarmRules, settings, journals, tierId } = useApp();
  const [range, setRange] = useState('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selDev, setSelDev] = useState(() => new Set(devices.map((d) => d.id)));
  const [selMet, setSelMet] = useState(() => new Set(METRIC_ORDER));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (set, setter) => (id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };
  const toggleDev = toggle(selDev, setSelDev);
  const toggleMet = toggle(selMet, setSelMet);

  // mode: 'download' saves a real .pdf file; 'print' opens the print dialog
  // (paper, or sharper Save-as-PDF output).
  const generate = async (mode) => {
    setErr('');
    const chosen = devices.filter((d) => selDev.has(d.id));
    if (chosen.length === 0) { setErr('Pick at least one plant.'); return; }
    if (selMet.size === 0) { setErr('Pick at least one sensor.'); return; }

    const now = Date.now();
    let start; let end = now; let rangeLabel;
    const preset = RANGES.find((r) => r.id === range);
    if (range === 'custom') {
      if (!from || !to) { setErr('Pick both dates.'); return; }
      start = new Date(from + 'T00:00:00').getTime();
      end = new Date(to + 'T23:59:59').getTime();
      if (!(start < end)) { setErr('The "from" date must be before the "to" date.'); return; }
      rangeLabel = `${new Date(start).toLocaleDateString()} – ${new Date(end).toLocaleDateString()}`;
    } else if (range === 'all') {
      const claims = chosen.map((d) => d.claimedAt).filter(Boolean);
      start = claims.length ? Math.min(...claims) : now - 90 * DAY;
      rangeLabel = 'Everything since your plants joined';
    } else {
      start = now - preset.ms;
      rangeLabel = preset.label;
    }

    setBusy(true);
    try {
      const histories = {};
      await Promise.all(chosen.map(async (d) => {
        if (d.losantDeviceId) {
          try {
            const res = await fetch(`/.netlify/functions/device-history?deviceId=${encodeURIComponent(d.losantDeviceId)}&start=${start}&end=${end}`);
            const data = res.ok ? await res.json() : null;
            histories[d.id] = (data && Array.isArray(data.points)) ? data.points : [];
          } catch {
            histories[d.id] = [];
          }
        } else {
          histories[d.id] = mockHistory(start, end); // demo plant
        }
      }));

      const metrics = METRIC_ORDER.filter((k) => selMet.has(k));
      const opts = {
        user, devices: chosen, gateways, alarmRules, settings, journals, tierId,
        report: { rangeLabel, start, end, metrics, histories },
      };
      if (mode === 'print') {
        const ok = openAccountExport(opts);
        if (!ok) { setErr('Your browser blocked the report window. Allow pop-ups and try again.'); setBusy(false); return; }
      } else {
        await downloadAccountPdf(opts);
      }
      onClose();
    } catch {
      setErr('Could not build the report. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2>Download report</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="muted" style={{ marginTop: -6 }}>
          A full PDF report with graphs of your sensor history, an activity timeline, and your account summary.
        </p>

        <div className="field__label" style={{ margin: '14px 0 8px' }}>Time period</div>
        <div className="exp-ranges">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`exp-range${range === r.id ? ' active' : ''}`}
              onClick={() => setRange(r.id)}
            >{r.label}</button>
          ))}
        </div>
        {range === 'custom' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <label style={{ flex: 1 }}>
              <span className="muted" style={{ fontSize: 11.5 }}>From</span>
              <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={{ marginTop: 4 }} />
            </label>
            <label style={{ flex: 1 }}>
              <span className="muted" style={{ fontSize: 11.5 }}>To</span>
              <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={{ marginTop: 4 }} />
            </label>
          </div>
        )}

        {devices.length > 1 && (
          <>
            <div className="field__label" style={{ margin: '16px 0 8px' }}>Plants ({selDev.size} of {devices.length})</div>
            {devices.map((d) => (
              <CheckRow key={d.id} checked={selDev.has(d.id)} onToggle={() => toggleDev(d.id)}>
                {d.name}{d.location ? <span className="muted"> · {d.location}</span> : null}
              </CheckRow>
            ))}
          </>
        )}

        <div className="field__label" style={{ margin: '16px 0 8px' }}>Sensors</div>
        {METRIC_ORDER.map((k) => (
          <CheckRow key={k} checked={selMet.has(k)} onToggle={() => toggleMet(k)} color={METRICS[k].color}>
            {METRICS[k].label} <span className="muted">({METRICS[k].unit})</span>
          </CheckRow>
        ))}

        {err && <p style={{ color: '#e74c3c', fontSize: 12.5, margin: '10px 0 0' }}>{err}</p>}

        <button className="btn btn--green" style={{ marginTop: 16, width: '100%' }} onClick={() => generate('download')} disabled={busy}>
          <FileDown size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          {busy ? 'Building your report…' : 'Download PDF'}
        </button>
        <button className="btn btn--ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => generate('print')} disabled={busy}>
          <Printer size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          Print report
        </button>
        <p className="muted center" style={{ margin: '8px 0 0', fontSize: 11.5 }}>
          Long periods are averaged so graphs stay readable. Gaps mean the device was offline.
        </p>
      </div>
    </div>
  );
}
