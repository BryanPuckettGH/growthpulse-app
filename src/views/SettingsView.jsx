import { useApp } from '../store/AppContext';
import { Pills, Toggle } from '../components/UI';
import { LogOut } from 'lucide-react';

const REFRESH_OPTIONS = [
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
];

export default function SettingsView() {
  const { settings, updateSettings, user, logout, tier, openPlans } = useApp();
  const n = settings.notifications || { push: true, email: false, emailAddr: '', sms: false, phone: '' };
  const setNotif = (patch) => updateSettings({ notifications: { ...n, ...patch } });

  return (
    <div>
      <div className="section-title">Plan</div>
      <div className="card">
        <div className="field__row">
          <div>
            <div className="field__label">{tier.name} plan</div>
            <div className="muted">{tier.tagline}</div>
          </div>
          <span className="badge" style={{ background: tier.color + '1a', color: tier.color }}>{tier.price}{tier.period}</span>
        </div>
        <button className="btn btn--green" style={{ marginTop: 12 }} onClick={openPlans}>See plans</button>
      </div>

      <div className="section-title">Display</div>

      <div className="card">
        <div className="field__row"><div className="field__label">Temperature units</div></div>
        <Pills
          options={[{ value: 'F', label: '°F' }, { value: 'C', label: '°C' }]}
          value={settings.units}
          onChange={(v) => updateSettings({ units: v })}
          blue
        />
      </div>

      <div className="card">
        <div className="field__row"><div className="field__label">Theme</div></div>
        <Pills
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'auto', label: 'Auto' }]}
          value={settings.theme}
          onChange={(v) => updateSettings({ theme: v })}
        />
      </div>

      <div className="section-title">Data</div>

      <div className="card">
        <div className="field__row">
          <div className="field__label">Refresh rate</div>
          <span className="muted">how often readings update</span>
        </div>
        <Pills options={REFRESH_OPTIONS} value={settings.refreshMs} onChange={(v) => updateSettings({ refreshMs: v })} blue />
      </div>

      <div className="section-title">Notifications</div>
      <div className="card">
        <p className="muted" style={{ marginTop: -2, marginBottom: 14 }}>How GrowthPulse alerts you when an alarm trips. These activate once your devices are connected to the cloud.</p>

        <div className="field__row">
          <div className="field__label">Push notifications</div>
          <Toggle checked={n.push} onChange={(v) => setNotif({ push: v })} />
        </div>

        <div className="field__row" style={{ marginTop: 16 }}>
          <div className="field__label">Email alerts</div>
          <Toggle checked={n.email} onChange={(v) => setNotif({ email: v })} />
        </div>
        {n.email && (
          <input className="input" type="email" placeholder="you@email.com" value={n.emailAddr} onChange={(e) => setNotif({ emailAddr: e.target.value })} style={{ marginTop: 6, marginBottom: 0 }} />
        )}

        <div className="field__row" style={{ marginTop: 16 }}>
          <div className="field__label">SMS alerts</div>
          <Toggle checked={n.sms} onChange={(v) => setNotif({ sms: v })} />
        </div>
        {n.sms && (
          <input className="input" type="tel" placeholder="+1 555 123 4567" value={n.phone} onChange={(e) => setNotif({ phone: e.target.value })} style={{ marginTop: 6, marginBottom: 0 }} />
        )}
      </div>

      <div className="section-title">Account</div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="avatar-lg">{user.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 700 }}>{user.name}</div>
            <div className="muted">{user.email}</div>
          </div>
        </div>
        <button className="btn btn--ghost" onClick={logout}>
          <LogOut size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Log out
        </button>
      </div>
    </div>
  );
}
