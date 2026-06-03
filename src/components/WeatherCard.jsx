import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { Sun, Cloud, CloudRain, CloudSnow, CloudDrizzle, MapPin } from 'lucide-react';

// Default location if the browser won't share GPS (Miami, near FIU).
const DEFAULT = { lat: 25.7617, lon: -80.1918, label: 'Miami, FL' };

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

// The "virtual rain gauge" from the proposal: local forecast + watering heads-up.
export default function WeatherCard() {
  const { settings } = useApp();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const unit = settings.units === 'C' ? 'celsius' : 'fahrenheit';

    const fetchFor = (lat, lon, label) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=precipitation_probability_max,temperature_2m_max,uv_index_max&temperature_unit=${unit}&timezone=auto&forecast_days=1`;
      fetch(url)
        .then((res) => res.json())
        .then((d) => {
          if (cancelled) return;
          setState({
            status: 'ok',
            label,
            temp: Math.round(d.current.temperature_2m),
            code: d.current.weather_code,
            rainChance: d.daily.precipitation_probability_max?.[0] ?? 0,
            uv: d.daily.uv_index_max?.[0] ?? 0,
            high: Math.round(d.daily.temperature_2m_max?.[0] ?? 0),
          });
        })
        .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchFor(pos.coords.latitude, pos.coords.longitude, 'Your location'),
        () => fetchFor(DEFAULT.lat, DEFAULT.lon, DEFAULT.label),
        { timeout: 5000 }
      );
    } else {
      fetchFor(DEFAULT.lat, DEFAULT.lon, DEFAULT.label);
    }
    return () => { cancelled = true; };
  }, [settings.units]);

  if (state.status === 'loading') {
    return <div className="card"><div className="skeleton" style={{ height: 60 }} /></div>;
  }
  if (state.status === 'error') {
    return <div className="card"><div className="muted">Weather unavailable right now.</div></div>;
  }

  const { label: cond, Icon, color } = describe(state.code);
  const unit = settings.units === 'C' ? '°C' : '°F';
  const rainy = state.rainChance >= 50;
  const sunny = !rainy && (state.uv >= 7 || state.high >= (settings.units === 'C' ? 32 : 90));

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Icon size={34} color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {state.temp}{unit} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>{cond}</span>
          </div>
          <div className="device__meta"><MapPin size={12} /> {state.label} · {state.rainChance}% rain today</div>
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
