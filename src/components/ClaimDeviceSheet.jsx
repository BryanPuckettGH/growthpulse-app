import { useState } from 'react';

// Real device claim: the user enters the pairing code from their GrowthPulse
// unit (for now this is the device's id), binding it to their account. The app
// then streams that device's real readings.
export default function ClaimDeviceSheet({ onClose, onClaim }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Connect your device</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 10 }}>
          Give your plant a name, then enter the pairing code from your GrowthPulse unit.
        </p>
        <input className="input" placeholder="Plant name (e.g. Kitchen Basil)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Pairing code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn btn--green" disabled={!code.trim()} onClick={() => { onClaim(code.trim(), name.trim() || 'My Plant'); onClose(); }}>
          Connect device
        </button>
      </div>
    </div>
  );
}
