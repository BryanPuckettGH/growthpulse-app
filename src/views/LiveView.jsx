import { useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  METRICS, PLANTS, statusOf, healthScore, recommendations, rangesForDevice, TRANSPORTS,
  displayValue, displayUnit, trendOf, metricConnected, timeAgo, effectiveTransport,
} from '../store/helpers';
import { MetricIcon, TransportIcon, Gauge, statusColor, PowerBadge } from '../components/UI';
import Chart from '../components/Chart';
import WeatherCard from '../components/WeatherCard';
import PlantPicker from '../components/PlantPicker';
import GrowthJournal from '../components/GrowthJournal';
import IrrigationCard from '../components/IrrigationCard';
import { AlertTriangle, Info, CheckCircle2, TrendingUp, TrendingDown, Minus, ChevronRight, CloudRain, Sparkles, Droplet, WifiOff } from 'lucide-react';

const HERO = ['airTemperatureF', 'airHumidity', 'soilMoisturePercent'];
const CHIPS = ['airTemperatureF', 'soilTemperatureF', 'airHumidity', 'soilMoisturePercent'];

function TrendIcon({ trend }) {
  if (trend === 'up') return <TrendingUp size={13} />;
  if (trend === 'down') return <TrendingDown size={13} />;
  return <Minus size={13} />;
}

function LockedWeather({ onUpgrade }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <CloudRain size={28} color="var(--ink-3)" />
      <div style={{ fontWeight: 700, marginTop: 6 }}>Weather rain gauge</div>
      <div className="muted" style={{ margin: '4px 0 12px' }}>Local rain and heavy-sun alerts so you water smarter. A Plus feature.</div>
      <button className="btn btn--blue" onClick={onUpgrade}>
        <Sparkles size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Unlock with Plus
      </button>
    </div>
  );
}

function DeviceWaiting({ device, connecting }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '34px 18px' }}>
      <img src="/growthpulse-icon.svg" alt="" style={{ width: 56, height: 56, margin: '0 auto 12px', display: 'block', opacity: 0.85 }} />
      <div style={{ fontWeight: 700, fontSize: 18 }}>{device.name}</div>
      {connecting ? (
        <p className="muted" style={{ marginTop: 6 }}>
          Connecting to your device and loading its latest readings. This usually takes a few seconds.
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 6 }}>
          Waiting for the first reading. Make sure your device is powered on and connected to Wi-Fi.
          Readings appear here automatically once it reports in.
        </p>
      )}
      <div className="device__meta" style={{ justifyContent: 'center', marginTop: 8 }}>
        <span className="dot" style={{ background: connecting ? '#f4a52b' : '#cfd3d8', marginRight: 6 }} />
        {connecting ? 'Connecting…' : 'Offline'}
      </div>
    </div>
  );
}

function LockedIrrigation({ onUpgrade }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <Droplet size={28} color="var(--ink-3)" />
      <div style={{ fontWeight: 700, marginTop: 6 }}>Automated watering</div>
      <div className="muted" style={{ margin: '4px 0 12px' }}>Connect a pump and water automatically when the soil gets dry. A Pro feature.</div>
      <button className="btn btn--blue" onClick={onUpgrade}>
        <Sparkles size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Unlock with Pro
      </button>
    </div>
  );
}

// When rain is likely, offer to pause automatic watering so the plant isn't overwatered.
function RainPausePrompt() {
  const { selectedDevice, weather, tier, setIrrigation } = useApp();
  const [dismissed, setDismissed] = useState(false);
  const irr = selectedDevice.irrigation || {};
  const paused = irr.pausedUntil && irr.pausedUntil > Date.now();
  const rainy = weather && weather.rainChance >= 50;
  const rainDelayOn = irr.rainDelay && selectedDevice.geo;

  // Only nudge to pause watering if rain delay is on (which requires location).
  if (!tier.irrigation || !rainDelayOn || !rainy || paused || dismissed) return null;

  const pause = (hours) => setIrrigation(selectedDevice.id, { pausedUntil: Date.now() + hours * 3600 * 1000 });

  return (
    <div className="card rainprompt">
      <div className="rainprompt__head"><CloudRain size={20} color="#13a4ff" /><b>Rain expected today</b></div>
      <p className="muted" style={{ margin: '4px 0 12px' }}>{weather.rainChance}% chance of rain. Pause automatic watering so you don't overwater?</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn--blue" onClick={() => pause(24)}>Pause 24h</button>
        <button className="btn btn--blue" onClick={() => pause(48)}>Pause 48h</button>
        <button className="btn btn--ghost" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setDismissed(true)}>Not now</button>
      </div>
    </div>
  );
}

export default function LiveView() {
  const { selectedDevice, settings, setDevicePlant, tier, openPlans, isConnecting } = useApp();
  const r = selectedDevice.reading;
  const u = settings.units;
  const ranges = rangesForDevice(selectedDevice);
  const health = healthScore(r, ranges);
  const recs = recommendations(r, ranges);
  const t = TRANSPORTS[effectiveTransport(selectedDevice)] || TRANSPORTS.wifi;
  const healthColor = health >= 80 ? '#2ecc71' : health >= 55 ? '#f4a52b' : '#ef4444';
  const plant = PLANTS[selectedDevice.plant] || PLANTS.generic;
  const [detailKey, setDetailKey] = useState(null);
  const [plantOpen, setPlantOpen] = useState(false);

  if (!selectedDevice.hasData) {
    return <DeviceWaiting device={selectedDevice} connecting={isConnecting(selectedDevice)} />;
  }

  return (
    <div>
      {!selectedDevice.online && (
        <div className="offlinebar">
          <WifiOff size={15} />
          Device offline · last reading {timeAgo(selectedDevice.lastSeen)}. Showing the most recent data.
        </div>
      )}
      <RainPausePrompt />
      <button className="plantbar" onClick={() => setPlantOpen(true)}>
        {selectedDevice.photo
          ? <img src={selectedDevice.photo} alt="" className="plantbar__photo" />
          : <span className="plantbar__emoji">{plant.emoji}</span>}
        <span className="plantbar__txt">
          <span className="plantbar__label">Plant profile</span>
          <span className="plantbar__name">{plant.name}</span>
        </span>
        <span className="plantbar__range">ideal moisture {ranges.soilMoisturePercent.good[0]}–{ranges.soilMoisturePercent.good[1]}%</span>
        <ChevronRight size={18} color="var(--ink-3)" />
      </button>

      <div className="card">
        <div className="hero">
          {HERO.map((k) => {
            const m = METRICS[k];
            const ok = metricConnected(k, r);
            return (
              <div className="hero__metric" key={k}>
                <div className="hero__val" style={{ color: ok ? statusColor(statusOf(k, r[k], ranges)) : 'var(--ink-3)' }}>
                  {ok ? <>{displayValue(k, r[k], u)}<span className="hero__unit">{displayUnit(m.unit, u)}</span></> : '—'}
                </div>
                <div className="hero__label">{m.label}{!ok && ' · not connected'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="gaugewrap">
          <Gauge
            value={metricConnected('soilMoisturePercent', r) ? r.soilMoisturePercent : 0}
            color={metricConnected('soilMoisturePercent', r) ? statusColor(statusOf('soilMoisturePercent', r.soilMoisturePercent, ranges)) : '#cfd3d8'}
            label={metricConnected('soilMoisturePercent', r) ? 'Moisture' : 'No probe'}
          />
          <div className="gauge__side">
            <div className="healthrow">
              <span className="health__score" style={{ color: healthColor }}>{health}</span>
              <span className="health__label">/ 100 plant health</span>
            </div>
            <div className="bar"><div className="bar__fill" style={{ width: `${health}%`, background: healthColor }} /></div>
            <div className="device__meta" style={{ marginTop: 12 }}>
              <span className="badge"><TransportIcon name={t.icon} color={t.color} />{t.label}</span>
              <PowerBadge reading={r} />
              {selectedDevice.location && <span>· {selectedDevice.location}</span>}
            </div>
          </div>
        </div>
      </div>

      {tier.weather ? <WeatherCard /> : <LockedWeather onUpgrade={openPlans} />}

      {tier.irrigation ? <IrrigationCard /> : <LockedIrrigation onUpgrade={openPlans} />}

      <div className="section-title">Sensors</div>
      <div className="chips">
        {CHIPS.map((k) => {
          const m = METRICS[k];
          const ok = metricConnected(k, r);
          const c = ok ? statusColor(statusOf(k, r[k], ranges)) : '#9aa1aa';
          const trend = trendOf(selectedDevice.history, k);
          return (
            <button className="chip chip--tap" key={k} onClick={() => ok && setDetailKey(k)} style={ok ? undefined : { cursor: 'default' }}>
              <div className="chip__icon" style={{ background: c + '1a' }}><MetricIcon name={m.icon} color={c} /></div>
              <div className="chip__txt">
                <div className="chip__label">{m.short}</div>
                <div className="chip__val">
                  {ok
                    ? <>{displayValue(k, r[k], u)}<span className="chip__unit">{displayUnit(m.unit, u)}</span></>
                    : <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>not connected</span>}
                </div>
              </div>
              {ok && <span className={`trend trend--${trend}`}><TrendIcon trend={trend} /></span>}
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

      <GrowthJournal />

      {detailKey && (
        <MetricDetail metricKey={detailKey} device={selectedDevice} units={u} onClose={() => setDetailKey(null)} />
      )}
      {plantOpen && (
        <PlantPicker
          current={selectedDevice.plant}
          onPick={(id) => { setDevicePlant(selectedDevice.id, id); setPlantOpen(false); }}
          onClose={() => setPlantOpen(false)}
        />
      )}
    </div>
  );
}

function MetricDetail({ metricKey, device, units, onClose }) {
  const m = METRICS[metricKey];
  const ranges = rangesForDevice(device);
  const points = device.history.map((h) => ({
    t: new Date(h.time).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
    value: displayValue(metricKey, h[metricKey], units),
  }));
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  const c = statusColor(statusOf(metricKey, device.reading[metricKey], ranges));
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
