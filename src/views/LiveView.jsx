import { useApp } from '../store/AppContext';
import { METRICS, statusOf, healthScore, recommendations, TRANSPORTS } from '../store/helpers';
import { MetricIcon, TransportIcon, Gauge, statusColor } from '../components/UI';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

const HERO = ['airTemperatureF', 'airHumidity', 'soilMoisturePercent'];
const CHIPS = ['airTemperatureF', 'soilTemperatureF', 'airHumidity', 'soilMoisturePercent'];

export default function LiveView() {
  const { selectedDevice } = useApp();
  const r = selectedDevice.reading;
  const health = healthScore(r);
  const recs = recommendations(r);
  const t = TRANSPORTS[selectedDevice.transport];
  const healthColor = health >= 80 ? '#2ecc71' : health >= 55 ? '#f4a52b' : '#ef4444';

  return (
    <div>
      {/* Hero readouts */}
      <div className="card">
        <div className="hero">
          {HERO.map((k) => {
            const m = METRICS[k];
            return (
              <div className="hero__metric" key={k}>
                <div className="hero__val" style={{ color: statusColor(statusOf(k, r[k])) }}>
                  {r[k]}<span className="hero__unit">{m.unit}</span>
                </div>
                <div className="hero__label">{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gauge + health score */}
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

      {/* Sensor chips */}
      <div className="section-title">Sensors</div>
      <div className="chips">
        {CHIPS.map((k) => {
          const m = METRICS[k];
          const c = statusColor(statusOf(k, r[k]));
          return (
            <div className="chip" key={k}>
              <div className="chip__icon" style={{ background: c + '1a' }}><MetricIcon name={m.icon} color={c} /></div>
              <div className="chip__txt">
                <div className="chip__label">{m.short}</div>
                <div className="chip__val">{r[k]}<span className="chip__unit">{m.unit}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Smart insights */}
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
    </div>
  );
}
