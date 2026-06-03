import { useState } from 'react';

// Real device claim: the user names their plant, sets its HOME location
// (weather and rain alerts follow the plant, not the owner's phone), and
// enters the short pairing code shown on the unit's screen. The code is
// validated against the registry; an unrecognized code is rejected.
export default function ClaimDeviceSheet({ onClose, onClaim }) {
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) { setError('Enter the pairing code shown on your device.'); return; }
    setBusy(true);
    setError('');
    const err = await onClaim(code.trim(), name.trim() || 'My Plant', place.trim());
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Connect your device</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Name your plant, tell us where it lives, and enter the pairing code on the device's screen.
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
