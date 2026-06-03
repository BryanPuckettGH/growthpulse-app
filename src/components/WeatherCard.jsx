import { useApp } from '../store/AppContext';
import { Sun, Cloud, CloudRain, CloudSnow, CloudDrizzle, MapPin } from 'lucide-react';

// Map Open-Meteo WMO weather codes to a label and icon.
function describe(code) {
  if (code === 0) return { label: 'Clear sky', Icon: Sun, color: '#f4a52b' };
  if (code <= 2) return { label: 'Mostly clear', Icon: Sun, color: '#f4a52b' };
  if (code === 3) return { label: 'Overcast', Icon: Cloud, color: '#8b97a6' };
  if (code >= 45 && code <= 48) return { label: 'Fog', Icon: Cloud, color: '#8b97a6' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', Icon: CloudDrizzle, color: '#13a4ff' };
  if (code >= 61 && code <= 67) return { label: 'Rain', Icon: CloudRain, color: '#13a4ff' };
  if (code >= 71 && code <= 77) return { label: 'Snow', Icon: CloudSnow, color: '#13a4ff' };
  if (code >= 80 && code <= 82) return { label: 'Rain showers', Icon: CloudRain, color: '#13a4ff' };
  if (code >= 95) return { label: 'Thunderstorm', Icon: CloudRain, color: '#a06bff' };
  return { label: 'Weather', Icon: Cloud, color: '#8b97a6' };
}

// The "virtual rain gauge" from the proposal. Reads the shared weather from the
// store (which is also what rain-aware watering uses).
export default function WeatherCard() {
  const { weather, settings } = useApp();

  if (!weather) {
    return <div className="card"><div className="skeleton" style={{ height: 60 }} /></div>;
  }
  if (weather.error) {
    return <div className="card"><div className="muted">Weather unavailable right now.</div></div>;
  }

  const { label: cond, Icon, color } = describe(weather.code);
  const unit = settings.units === 'C' ? '°C' : '°F';
  const rainy = weather.rainChance >= 50;
  const sunny = !rainy && (weather.uv >= 7 || weather.high >= (settings.units === 'C' ? 32 : 90));

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Icon size={34} color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {weather.temp}{unit} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>{cond}</span>
          </div>
          <div className="device__meta">
            <MapPin size={12} /> {weather.label}{weather.pinned ? ' (plant’s home)' : ''} · {weather.rainChance}% rain · high {weather.high}{unit}
          </div>
        </div>
      </div>
      {rainy && (
        <div className="weather-note weather-note--rain">
          <CloudRain size={15} /> Rain likely today. You can hold off on watering, the virtual rain gauge has it covered.
        </div>
      )}
      {sunny && (
        <div className="weather-note weather-note--sun">
          <Sun size={15} /> Strong sun and heat expected. Plants may dry out faster, keep an eye on soil moisture.
        </div>
      )}
    </div>
  );
}
