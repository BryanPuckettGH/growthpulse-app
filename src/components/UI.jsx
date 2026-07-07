/* Small reusable UI building blocks: icons, pills, toggle, slider,
   stepper, gauge, badge. Kept in one file so the views stay short. */
import { Thermometer, Droplets, Sprout, Waves, Wifi, RadioTower, CloudRain, Plug, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, Droplet, AlertTriangle } from 'lucide-react';
import { powerInfo } from '../store/helpers';

const METRIC_ICONS = { temp: Thermometer, humidity: Droplets, moisture: Sprout, soil: Waves, rain: CloudRain, flow: Droplet, leak: AlertTriangle };
const TRANSPORT_ICONS = { wifi: Wifi, lora: RadioTower };

export function MetricIcon({ name, size = 18, color }) {
  const I = METRIC_ICONS[name] || Thermometer;
  return <I size={size} color={color} strokeWidth={2.2} />;
}

export function TransportIcon({ name, size = 13, color }) {
  const I = TRANSPORT_ICONS[name] || Wifi;
  return <I size={size} color={color} strokeWidth={2.2} />;
}

// Power chip: "AC" for plugged-in units, battery % (with charging bolt) otherwise.
// compact keeps it short for tight rows like the device cards.
export function PowerBadge({ reading, size = 13, compact = false }) {
  const p = powerInfo(reading);
  if (p.mode === 'ac') {
    return <span className="badge"><Plug size={size} />{compact ? 'AC' : 'AC power'}</span>;
  }
  const Icon = p.charging ? BatteryCharging : p.pct > 50 ? BatteryFull : p.pct > 20 ? BatteryMedium : BatteryLow;
  const color = p.charging ? '#13a4ff' : p.pct > 50 ? '#2ecc71' : p.pct > 20 ? '#f4a52b' : '#ef4444';
  return (
    <span className="badge" style={{ color }}>
      <Icon size={size + 2} color={color} />{p.pct}%{!compact && p.charging ? ' charging' : ''}
    </span>
  );
}

const STATUS_COLORS = { good: '#2ecc71', warn: '#f4a52b', critical: '#ef4444' };
export const statusColor = (s) => STATUS_COLORS[s] || STATUS_COLORS.good;

export function Pills({ options, value, onChange, blue }) {
  return (
    <div className="pills">
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const disabled = typeof o === 'object' && !!o.disabled;
        return (
          <button
            key={val}
            disabled={disabled}
            title={disabled && typeof o === 'object' ? o.disabledHint : undefined}
            className={`pill ${value === val ? 'active' : ''} ${blue ? 'blue' : ''}`}
            onClick={() => !disabled && onChange(val)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <label className={`switch${disabled ? ' switch--disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" />
      <span className="switch__thumb" />
    </label>
  );
}

export function Slider({ min, max, step = 1, value, onChange }) {
  return (
    <input
      type="range"
      className="slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function Stepper({ value, min = 0, max = 100, step = 1, suffix = '', onChange }) {
  const set = (v) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="stepper">
      <button className="stepper__btn" onClick={() => set(value - step)}>−</button>
      <span className="stepper__val">{value}{suffix}</span>
      <button className="stepper__btn" onClick={() => set(value + step)}>+</button>
    </div>
  );
}

export function Gauge({ value, size = 116, color = '#2ecc71', label = '' }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const offset = c - (pct / 100) * c;
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="gauge__center">
        <div>
          <div className="gauge__num">
            {Math.round(value)}<span style={{ fontSize: 14 }}>%</span>
          </div>
          <div className="gauge__cap">{label}</div>
        </div>
      </div>
    </div>
  );
}
