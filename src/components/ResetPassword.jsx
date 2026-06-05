import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

// Shown when the user arrives from a password-reset email link.
// They set a new password and continue straight into the app.
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < 6) { setError('Password needs at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    setError('');
    const err = await updatePassword(password);
    setBusy(false);
    if (err) setError(err);
    // On success the recovery flag clears and the app loads.
  };

  return (
    <div className="login">
      <div className="brand">
        <img className="brand__icon" src="/growthpulse-icon.svg" alt="" />
        <div className="brand__word">Growth<span className="brand__word-accent">Pulse</span></div>
        <div className="brand__tag">SMART PLANT MONITORING</div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Set a new password</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          You're signed in through your reset link. Choose a new password to finish.
        </p>
        <input className="input" type="password" placeholder="New password" autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="input" type="password" placeholder="Confirm new password" autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />

        {error && <p className="center" style={{ color: 'var(--red)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

        <button className="btn btn--green" disabled={busy} onClick={submit}>
          {busy ? 'Saving...' : 'Save new password'}
        </button>
      </div>
    </div>
  );
}
