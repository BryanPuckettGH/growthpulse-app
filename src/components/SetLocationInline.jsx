import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { geocodePlace } from '../utils/geocode';
import { MapPin } from 'lucide-react';

// A small, self-contained "add this plant's location" control. Geocodes a
// city or ZIP and pins it to the device, which immediately enables weather
// and rain delay. Used by the weather card and the rain-delay gate so the
// customer never has to leave what they're doing.
export default function SetLocationInline({ device, cta = 'Save location', onDone }) {
  const { updateDevice } = useApp();
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    const q = place.trim();
    if (!q) { setErr('Enter a city or ZIP code.'); return; }
    setBusy(true);
    setErr('');
    const geo = await geocodePlace(q);
    setBusy(false);
    if (!geo) { setErr("Couldn't find that place. Try a city name or ZIP."); return; }
    updateDevice(device.id, { location: geo.label, geo });
    if (onDone) onDone(geo);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="City or ZIP (e.g. Miami or 33199)"
          style={{ marginBottom: 0, flex: 1 }}
        />
        <button className="btn btn--blue" style={{ width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }} disabled={busy} onClick={save}>
          <MapPin size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />{busy ? 'Finding…' : cta}
        </button>
      </div>
      {err && <p style={{ color: '#e74c3c', fontSize: 12, margin: '6px 2px 0' }}>{err}</p>}
    </div>
  );
}
