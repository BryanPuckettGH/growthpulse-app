import { useState } from 'react';
import { Wifi, RadioTower } from 'lucide-react';

// Real device claim: pick how the node gets online (its own Wi-Fi, or
// through a LoRaWAN gateway), name the plant, set its HOME location
// (weather follows the plant, not the owner's phone), and enter the
// pairing code shown on the unit's screen.
export default function ClaimDeviceSheet({ onClose, onClaim }) {
  const [transport, setTransport] = useState('wifi');
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) { setError('Enter the pairing code shown on your device.'); return; }
    setBusy(true);
    setError('');
    const err = await onClaim(code.trim(), name.trim() || 'My Plant', place.trim(), transport);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Connect your device</h2>

        <div className="fieldlabel">How does it connect?</div>
        <div className="rolechips">
          <button type="button" className={`rolechip ${transport === 'wifi' ? 'active' : ''}`} onClick={() => setTransport('wifi')}>
            <Wifi size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Wi-Fi
          </button>
          <button type="button" className={`rolechip ${transport === 'lorawan' ? 'active' : ''}`} onClick={() => setTransport('lorawan')}>
            <RadioTower size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />LoRaWAN gateway
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '-4px 2px 12px' }}>
          {transport === 'wifi'
            ? 'Power the unit on and follow its Wi-Fi setup from your phone, then enter the code below. Updates every few seconds.'
            : 'No Wi-Fi needed. Power the node near your gateway and it joins on its own, then enter the code below. Reports every few minutes, which is what makes batteries last for months.'}
        </p>

        <div className="fieldlabel">Plant name</div>
        <input className="input" placeholder="e.g. Kitchen Basil" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="fieldlabel">Plant's home location (city or ZIP)</div>
        <input className="input" placeholder="e.g. Miami or 33199" value={place} onChange={(e) => setPlace(e.target.value)} />
        <p className="muted" style={{ fontSize: 12, margin: '-6px 2px 10px' }}>
          Weather and rain alerts follow the plant's home, so they stay accurate even when you travel.
        </p>

        <div className="fieldlabel">Pairing code (on the device screen)</div>
        <input className="input" placeholder="e.g. 4A7AC" value={code} onChange={(e) => setCode(e.target.value)} />

        {error && <p className="center" style={{ color: 'var(--red)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

        <button className="btn btn--green" disabled={busy} onClick={submit}>
          {busy ? 'Connecting...' : 'Connect device'}
        </button>
      </div>
    </div>
  );
}
