import { useState } from 'react';

// Real device claim: the user enters the short pairing code printed on their
// GrowthPulse unit. It is validated against the registry, then bound to the
// account. An unrecognized code is rejected.
export default function ClaimDeviceSheet({ onClose, onClaim }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) { setError('Enter your pairing code.'); return; }
    setBusy(true);
    setError('');
    const err = await onClaim(code.trim(), name.trim() || 'My Plant');
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Connect your device</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 10 }}>
          Give your plant a name, then enter the pairing code printed on your GrowthPulse unit.
        </p>
        <input className="input" placeholder="Plant name (e.g. Kitchen Basil)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Pairing code" value={code} onChange={(e) => setCode(e.target.value)} />
        {error && <p className="center" style={{ color: 'var(--red)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
        <button className="btn btn--green" disabled={busy} onClick={submit}>
          {busy ? 'Connecting...' : 'Connect device'}
        </button>
      </div>
    </div>
  );
}
