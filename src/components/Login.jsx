import { useState } from 'react';
import { useApp } from '../store/AppContext';

// Branded sign-in screen. The wordmark is composed from the icon + text so it
// adapts to light and dark themes (the flat logo SVG has a fixed navy wordmark).
export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  return (
    <div className="login">
      <div className="brand">
        <img className="brand__icon" src="/growthpulse-icon.svg" alt="" />
        <div className="brand__word">Growth<span className="brand__word-accent">Pulse</span></div>
        <div className="brand__tag">SMART PLANT MONITORING</div>
      </div>

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
