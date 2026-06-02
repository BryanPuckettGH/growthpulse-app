import { useApp } from '../store/AppContext';
import { Pills } from '../components/UI';
import { LogOut } from 'lucide-react';

const REFRESH_OPTIONS = [
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
];

export default function SettingsView() {
  const { settings, updateSettings, user, logout } = useApp();

  return (
    <div>
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
