import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

const ROLES = ['Hobbyist', 'Home grower', 'Farmer', 'Commercial'];

// Real sign-in / sign-up using Supabase auth, plus a demo mode for prospects.
export default function Login() {
  const { login, signup, startDemo, resetPassword } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [role, setRole] = useState('Hobbyist');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const forgot = async () => {
    if (!email) { setError('Type your email above first, then tap Forgot password.'); return; }
    setBusy(true);
    setError('');
    setInfo('');
    const err = await resetPassword(email.trim());
    setBusy(false);
    if (err) setError(err);
    else setInfo('Reset link sent. Check your email (and spam) to set a new password.');
  };

  const submit = async () => {
    if (!email || !password) { setError('Enter your email and password.'); return; }
    if (mode === 'signup') {
      if (!first.trim() || !last.trim()) { setError('Enter your first and last name.'); return; }
      if (password.length < 6) { setError('Password needs at least 6 characters.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
    }
    setBusy(true);
    setError('');
    const err = mode === 'login'
      ? await login(email, password)
      : await signup(email, password, { first_name: first.trim(), last_name: last.trim(), grower_type: role });
    setBusy(false);
    if (err) setError(err);
    // On success the auth state changes and the app loads automatically.
  };
  const enter = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="login">
      <div className="brand">
        <img className="brand__icon" src="/growthpulse-icon.svg" alt="" />
        <div className="brand__word">Growth<span className="brand__word-accent">Pulse</span></div>
        <div className="brand__tag">SMART PLANT MONITORING</div>
      </div>

      <div className="card">
        {mode === 'signup' && (
          <div className="row2">
            <input className="input" placeholder="First name" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} />
            <input className="input" placeholder="Last name" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
        )}
        <input className="input" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={mode === 'login' ? enter : undefined} />
        {mode === 'signup' && (
          <>
            <input className="input" type="password" placeholder="Confirm password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={enter} />
            <div className="fieldlabel">I grow as a...</div>
            <div className="rolechips">
              {ROLES.map((r) => (
                <button key={r} type="button" className={`rolechip ${role === r ? 'active' : ''}`} onClick={() => setRole(r)}>{r}</button>
              ))}
            </div>
          </>
        )}

        {error && <p className="center" style={{ color: 'var(--red)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
        {info && <p className="center" style={{ color: 'var(--green-d)', fontSize: 13, margin: '0 0 10px', fontWeight: 600 }}>{info}</p>}

        <button className="btn btn--green" disabled={busy} onClick={submit}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={startDemo}>Explore the demo</button>

        {mode === 'login' && (
          <p className="muted center" style={{ marginTop: 12, marginBottom: 0 }}>
            <span style={{ color: 'var(--green-d)', fontWeight: 700, cursor: 'pointer' }} onClick={forgot}>
              Forgot your password?
            </span>
          </p>
        )}

        <p className="muted center" style={{ marginTop: 14 }}>
          {mode === 'login' ? 'New to GrowthPulse? ' : 'Already have an account? '}
          <span style={{ color: 'var(--green-d)', fontWeight: 700, cursor: 'pointer' }}
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  );
}
