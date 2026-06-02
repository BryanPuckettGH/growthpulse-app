import { useState } from 'react';
import { useApp } from '../store/AppContext';

// Branded sign-in screen using the real GrowthPulse logo. In demo mode any
// email works, or the user can tap straight through. Later: real Losant login.
export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  return (
    <div className="login">
      <img className="brand__img" src="/growthpulse-logo.svg" alt="GrowthPulse - Smart Plant Monitoring" />

      <div className="card">
        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
        <button className="btn btn--green" onClick={() => login(email)}>Sign in</button>
        <p className="muted center" style={{ marginTop: 14 }}>
          Demo mode. Use any email, or{' '}
          <span style={{ color: 'var(--green-d)', fontWeight: 700, cursor: 'pointer' }} onClick={() => login('demo@growthpulse.io')}>
            continue as demo
          </span>
          .
        </p>
      </div>
    </div>
  );
}
