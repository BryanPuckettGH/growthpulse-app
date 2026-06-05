import { useApp } from '../store/AppContext';
import { Pills, Toggle } from '../components/UI';
import { openAccountExport } from '../utils/accountExport';
import { LogOut, Download } from 'lucide-react';
import pkg from '../../package.json';

export default function SettingsView() {
  const { settings, updateSettings, user, logout, tier, openPlans, devices, alarmRules, journals, gateways, tierId } = useApp();

  // The customer-facing export: a branded PDF-ready document.
  const exportPdf = () => {
    openAccountExport({ user, devices, gateways, alarmRules, settings, journals, tierId });
  };

  // Machine-readable copy (data portability); secondary on purpose.
  const exportJson = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      account: { name: user.name, email: user.email, growerType: user.growerType, plan: tierId },
      devices: devices.map(({ id, name, location, geo, group, transport, plant, irrigation, losantDeviceId }) =>
        ({ id, name, location, geo, group, transport, plant, irrigation, losantDeviceId })),
      gateways,
      alarmRules,
      settings,
      journals,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'GrowthPulse data export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Second-by-second refresh only makes sense for Wi-Fi nodes. LoRaWAN nodes
  // check in every few minutes, so the fast rates grey out without Wi-Fi.
  const hasLora = devices.some((d) => d.transport === 'lorawan');
  const wifiPresent = devices.some((d) => d.transport === 'wifi');
  const secondsHint = 'Needs a Wi-Fi device. LoRaWAN nodes report every few minutes.';
  const refreshOptions = [
    { value: 1000, label: '1s', disabled: !wifiPresent, disabledHint: secondsHint },
    { value: 2000, label: '2s', disabled: !wifiPresent, disabledHint: secondsHint },
    { value: 5000, label: '5s', disabled: !wifiPresent, disabledHint: secondsHint },
    { value: 10000, label: '10s', disabled: !wifiPresent, disabledHint: secondsHint },
    { value: 60000, label: '1m' },
    { value: 300000, label: '5m' },
  ];
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
        <Pills options={refreshOptions} value={settings.refreshMs} onChange={(v) => updateSettings({ refreshMs: v })} blue />
        {hasLora && (
          <p className="muted" style={{ fontSize: 12.5, margin: '10px 2px 0' }}>
            LoRaWAN nodes check in every few minutes by design, so faster rates only apply to your Wi-Fi devices{wifiPresent ? '' : ' (you have none right now, which is why the second options are off)'}.
          </p>
        )}
        <p className="muted" style={{ fontSize: 12.5, margin: '8px 2px 0' }}>
          On battery-powered units, faster updates mean shorter battery life.
        </p>
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
            <div style={{ fontWeight: 700 }}>
              {user.name}
              {user.growerType && (
                <span className="badge" style={{ marginLeft: 8, background: '#eafaf0', color: 'var(--green-d)' }}>{user.growerType}</span>
              )}
            </div>
            <div className="muted">{user.email}</div>
          </div>
        </div>
        <button className="btn btn--ghost" onClick={exportPdf}>
          <Download size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Download my data (PDF)
        </button>
        <p className="muted center" style={{ margin: '8px 0 0', fontSize: 12 }}>
          Need it for software? <span style={{ color: 'var(--green-d)', fontWeight: 700, cursor: 'pointer' }} onClick={exportJson}>Machine-readable copy (JSON)</span>
        </p>
        <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={logout}>
          <LogOut size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Log out
        </button>
      </div>

      <p className="muted center" style={{ margin: '18px 0 6px', fontSize: 12 }}>
        GrowthPulse v{pkg.version} · build {typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'dev'}
      </p>
    </div>
  );
}
