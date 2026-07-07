import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { formatVolume, formatMoney, waterCost, volumeUnitLabel, litersToUnit } from '../store/helpers';
import { Droplet, AlertTriangle, TrendingUp } from 'lucide-react';

/* ============================================================
   WaterCard
   ------------------------------------------------------------
   The water meter: live flow while watering, how much water (and
   money) this plant used today / this week / this month, and the
   two safety warnings from the node:
     flowFault    - the valve opened but no water moved
     leakDetected - water is moving while the valve is closed
   Real devices get usage from the water-usage function (which
   diffs the node's lifetime counter, meter-style). Demo devices
   synthesize believable numbers so the card demos well.
   ============================================================ */

const DAY = 86400000;

// Local-midnight timestamp for "today", so daily buckets follow the user's clock.
function localMidnight(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Deterministic pseudo-random dailies for demo devices (stable per device+day,
// so the numbers don't jump around on every refresh).
function demoDaily(deviceId, dayTs) {
  let h = 2166136261;
  const s = `${deviceId}:${Math.floor(dayTs / DAY)}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const u = ((h >>> 0) % 1000) / 1000;
  return +(2 + u * 9).toFixed(2); // 2-11 L/day, garden-scale
}

export default function WaterCard() {
  const { selectedDevice, settings } = useApp();
  const r = selectedDevice.reading;
  const unit = settings.waterUnit || 'gal';
  const [usage, setUsage] = useState(null); // [{ t, liters }] for the last 30 days

  const claimed = !!selectedDevice.losantDeviceId;
  const hasMeter = r.flowLpm != null || r.waterTotalL != null;
  const watering = !!(selectedDevice.pumpRunning || r.valveOpen);

  // Load 30 daily buckets. Real: the cumulative-counter diff endpoint.
  // Demo: stable synthesized dailies. Refreshes each minute and when a
  // watering run ends (that's when the counter has just moved).
  useEffect(() => {
    let cancelled = false;
    const startOfToday = localMidnight();
    const start = startOfToday - 29 * DAY;
    const load = async () => {
      if (!claimed) {
        const days = [];
        for (let t = start; t <= startOfToday; t += DAY) days.push({ t, liters: demoDaily(selectedDevice.id, t) });
        // Today so far: scale by clock progress + anything the live session added.
        const frac = (Date.now() - startOfToday) / DAY;
        days[days.length - 1].liters = +(days[days.length - 1].liters * frac + (r.waterSessionL || 0)).toFixed(2);
        if (!cancelled) setUsage(days);
        return;
      }
      try {
        const res = await fetch(`/.netlify/functions/water-usage?deviceId=${encodeURIComponent(selectedDevice.losantDeviceId)}&start=${start}&end=${Date.now()}&bucketMs=${DAY}`);
        if (res.ok) {
          const j = await res.json();
          if (!cancelled && Array.isArray(j.buckets)) setUsage(j.buckets);
        }
      } catch { /* keep the last numbers */ }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice.id, claimed, watering]);

  const totals = useMemo(() => {
    if (!usage || usage.length === 0) return null;
    const startOfToday = localMidnight();
    const sum = (fromTs) => usage.filter((b) => b.t >= fromTs).reduce((a, b) => a + (b.liters || 0), 0);
    return {
      today: sum(startOfToday),
      week: sum(startOfToday - 6 * DAY),
      month: sum(startOfToday - 29 * DAY),
    };
  }, [usage]);

  if (!hasMeter) return null; // node without a flow sensor: no water card

  const rate = Number(settings.waterPricePerK) || 0;
  const rows = totals ? [
    { label: 'Today', liters: totals.today },
    { label: 'This week', liters: totals.week },
    { label: 'This month', liters: totals.month },
  ] : [];

  return (
    <>
      <div className="section-title">Water</div>

      {r.flowFault && (
        <div className="card" style={{ borderLeft: '4px solid #ef4444', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700 }}>No water flow detected</div>
              <p className="muted" style={{ margin: '3px 0 0' }}>
                The last watering opened the valve but the sensor saw no water, so the valve was
                closed automatically. Check the reservoir, supply line, and pump, then water again;
                a successful run clears this warning.
              </p>
            </div>
          </div>
        </div>
      )}

      {r.leakDetected && (
        <div className="card" style={{ borderLeft: '4px solid #ef4444', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700 }}>Possible leak</div>
              <p className="muted" style={{ margin: '3px 0 0' }}>
                Water has been flowing while the valve is closed. Check for a stuck valve or a leak
                after the sensor. This clears itself when the flow stops.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="field__row" style={{ marginBottom: totals ? 14 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="chip__icon" style={{ background: watering ? '#13a4ff1a' : 'var(--bg-2, #f2f4f6)' }}>
              <Droplet size={18} color={watering ? '#13a4ff' : 'var(--ink-3)'} />
            </div>
            <div>
              <div className="field__label">{watering ? 'Water flowing' : 'Flow'}</div>
              <div className="muted">
                {r.flowLpm != null
                  ? `${litersToUnit(r.flowLpm, unit).toFixed(2)} ${volumeUnitLabel(unit)}/min`
                  : 'no reading yet'}
                {r.waterSessionL != null && r.waterSessionL > 0 && ` · ${watering ? 'this run' : 'last run'} ${formatVolume(r.waterSessionL, unit)}`}
              </div>
            </div>
          </div>
          {watering && <span className="dot" style={{ background: '#13a4ff' }} />}
        </div>

        {rows.map((row) => (
          <div className="field__row" key={row.label} style={{ marginTop: 8 }}>
            <span className="muted">{row.label}</span>
            <span className="field__value">
              {formatVolume(row.liters, unit)}
              {rate > 0 && <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}> · {formatMoney(waterCost(row.liters, settings))}</span>}
            </span>
          </div>
        ))}

        {r.waterTotalL != null && (
          <div className="field__row" style={{ marginTop: 8 }}>
            <span className="muted"><TrendingUp size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Lifetime</span>
            <span className="field__value">{formatVolume(r.waterTotalL, unit)}</span>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12, margin: '12px 2px 0' }}>
          {rate > 0
            ? `Costs use your rate of $${rate.toFixed(2)} per 1,000 ${volumeUnitLabel(unit)}. Change it in Settings.`
            : 'Set your water price in Settings to see costs here.'}
        </p>
      </div>
    </>
  );
}
