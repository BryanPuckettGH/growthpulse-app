import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

// Real sign-in / sign-up using Supabase auth.
export default function Login() {
  const { login, signup, startDemo } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    setError('');
    const err = mode === 'login' ? await login(email, password) : await signup(email, password);
    setBusy(false);
    if (err) setError(err);
    // On success the auth state changes and the app loads automatically.
  };

  return (
    <div className="login">
      <div className="brand">
        <img className="brand__icon" src="/growthpulse-icon.svg" alt="" />
        <div className="brand__word">Growth<span className="brand__word-accent">Pulse</span></div>
        <div className="brand__tag">SMART PLANT MONITORING</div>
      </div>

      <div className="card">
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />

        {error && <p className="center" style={{ color: 'var(--red)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

        <button className="btn btn--green" disabled={busy} onClick={submit}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={startDemo}>Explore the demo</button>

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
