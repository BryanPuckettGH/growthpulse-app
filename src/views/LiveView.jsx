import { useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  METRICS, statusOf, healthScore, recommendations, TRANSPORTS,
  displayValue, displayUnit, trendOf,
} from '../store/helpers';
import { MetricIcon, TransportIcon, Gauge, statusColor } from '../components/UI';
import Chart from '../components/Chart';
import { AlertTriangle, Info, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const HERO = ['airTemperatureF', 'airHumidity', 'soilMoisturePercent'];
const CHIPS = ['airTemperatureF', 'soilTemperatureF', 'airHumidity', 'soilMoisturePercent'];

function TrendIcon({ trend }) {
  if (trend === 'up') return <TrendingUp size={13} />;
  if (trend === 'down') return <TrendingDown size={13} />;
  return <Minus size={13} />;
}

export default function LiveView() {
  const { selectedDevice, settings } = useApp();
  const r = selectedDevice.reading;
  const u = settings.units;
  const health = healthScore(r);
  const recs = recommendations(r);
  const t = TRANSPORTS[selectedDevice.transport];
  const healthColor = health >= 80 ? '#2ecc71' : health >= 55 ? '#f4a52b' : '#ef4444';
  const [detailKey, setDetailKey] = useState(null);

  return (
    <div>
      <div className="card">
        <div className="hero">
          {HERO.map((k) => {
            const m = METRICS[k];
            return (
              <div className="hero__metric" key={k}>
                <div className="hero__val" style={{ color: statusColor(statusOf(k, r[k])) }}>
                  {displayValue(k, r[k], u)}<span className="hero__unit">{displayUnit(m.unit, u)}</span>
                </div>
                <div className="hero__label">{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="gaugewrap">
          <Gauge value={r.soilMoisturePercent} color={statusColor(statusOf('soilMoisturePercent', r.soilMoisturePercent))} label="Moisture" />
          <div className="gauge__side">
            <div className="healthrow">
              <span className="health__score" style={{ color: healthColor }}>{health}</span>
              <span className="health__label">/ 100 plant health</span>
            </div>
            <div className="bar"><div className="bar__fill" style={{ width: `${health}%`, background: healthColor }} /></div>
            <div className="device__meta" style={{ marginTop: 12 }}>
              <span className="badge"><TransportIcon name={t.icon} color={t.color} />{t.label}</span>
              <span>· {selectedDevice.location}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">Sensors</div>
      <div className="chips">
        {CHIPS.map((k) => {
          const m = METRICS[k];
          const c = statusColor(statusOf(k, r[k]));
          const trend = trendOf(selectedDevice.history, k);
          return (
            <button className="chip chip--tap" key={k} onClick={() => setDetailKey(k)}>
              <div className="chip__icon" style={{ background: c + '1a' }}><MetricIcon name={m.icon} color={c} /></div>
              <div className="chip__txt">
                <div className="chip__label">{m.short}</div>
                <div className="chip__val">{displayValue(k, r[k], u)}<span className="chip__unit">{displayUnit(m.unit, u)}</span></div>
              </div>
              <span className={`trend trend--${trend}`}><TrendIcon trend={trend} /></span>
            </button>
          );
        })}
      </div>

      <div className="section-title">Insights</div>
      <div className="card tight">
        {recs.map((rec, i) => {
          const Icon = rec.level === 'critical' ? AlertTriangle : rec.level === 'warn' ? Info : CheckCircle2;
          const c = rec.level === 'critical' ? '#ef4444' : rec.level === 'warn' ? '#f4a52b' : '#2ecc71';
          return (
            <div className="insight" key={i}>
              <div className="insight__icon" style={{ background: c + '1a' }}><Icon size={17} color={c} /></div>
              <div className="insight__text">{rec.text}</div>
            </div>
          );
        })}
      </div>

      {detailKey && (
        <MetricDetail metricKey={detailKey} device={selectedDevice} units={u} onClose={() => setDetailKey(null)} />
      )}
    </div>
  );
}

function MetricDetail({ metricKey, device, units, onClose }) {
  const m = METRICS[metricKey];
  const points = device.history.map((h) => ({
    t: new Date(h.time).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
    value: displayValue(metricKey, h[metricKey], units),
  }));
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  const c = statusColor(statusOf(metricKey, device.reading[metricKey]));
  const unit = displayUnit(m.unit, units);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>{m.label}</h2>
        <div className="hero__val" style={{ color: c, marginBottom: 6 }}>
          {displayValue(metricKey, device.reading[metricKey], units)}<span className="hero__unit">{unit}</span>
        </div>
        <div className="chart__stats" style={{ marginBottom: 10 }}>
          <span>Max <b>{max}{unit}</b></span>
          <span>Avg <b>{avg}{unit}</b></span>
          <span>Min <b>{min}{unit}</b></span>
        </div>
        <Chart series={{ points, min, max, avg }} color={m.color} />
      </div>
    </div>
  );
}
