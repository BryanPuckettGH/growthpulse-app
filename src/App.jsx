import { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Login from './components/Login';
import LiveView from './views/LiveView';
import HistoryView from './views/HistoryView';
import AlarmsView from './views/AlarmsView';
import DevicesView from './views/DevicesView';
import SettingsView from './views/SettingsView';
import PlansSheet from './components/PlansSheet';
import Onboarding from './components/Onboarding';
import { activeAlerts, METRICS } from './store/helpers';
import { Activity, LineChart, Bell, LayoutGrid, Settings, ChevronDown } from 'lucide-react';

const TABS = [
  { id: 'live', label: 'Live', icon: Activity, View: LiveView },
  { id: 'history', label: 'History', icon: LineChart, View: HistoryView },
  { id: 'alarms', label: 'Alarms', icon: Bell, View: AlarmsView },
  { id: 'devices', label: 'Devices', icon: LayoutGrid, View: DevicesView },
  { id: 'settings', label: 'Settings', icon: Settings, View: SettingsView },
];

function useTheme(theme) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved = theme === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      root.setAttribute('data-theme', resolved);
    };
    apply();
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);
}

function Shell() {
  const { user, selectedDevice, devices, alarmRules, settings, showPlans, closePlans } = useApp();
  const [tab, setTab] = useState('live');
  const [toast, setToast] = useState(null);
  const prevKeys = useRef(new Set());
  const initialized = useRef(false);
  useTheme(settings.theme);

  const alerts = activeAlerts(devices, alarmRules);
  const alertCount = alerts.length;
  const alertKey = alerts.map((a) => (a.device ? a.device.id : 'weather') + ':' + a.rule.id).sort().join(',');

  useEffect(() => {
    const keys = new Set(alertKey ? alertKey.split(',') : []);
    if (!initialized.current) { prevKeys.current = keys; initialized.current = true; return; }
    let appeared = null;
    keys.forEach((k) => { if (!prevKeys.current.has(k)) appeared = k; });
    prevKeys.current = keys;
    if (appeared) {
      const a = alerts.find((x) => (x.device ? x.device.id : 'weather') + ':' + x.rule.id === appeared);
      if (a) {
        const m = METRICS[a.rule.metric];
        setToast(`${a.device ? a.device.name : 'Weather'}: ${m.label} ${a.rule.op} ${a.rule.value}${m.unit}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertKey]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (devices.length === 0) return <Onboarding />;

  const ActiveView = TABS.find((t) => t.id === tab).View;

  return (
    <div className="shell">
      <div className="appbar">
        <img className="appbar__brand" src="/growthpulse-icon.svg" alt="" />
        <div className="appbar__title">
          <div className="appbar__name" onClick={() => setTab('devices')}>
            {selectedDevice.name} <ChevronDown size={16} />
          </div>
          <div className="appbar__sub">{selectedDevice.location}</div>
        </div>
        <button className="iconbtn avatar" title="Account" onClick={() => setTab('settings')}>
          {user.name.charAt(0).toUpperCase()}
        </button>
      </div>

      <div className="content fade-in" key={tab}>
        <ActiveView />
      </div>

      <div className="tabbar">
        <div className="tabbar__brand">
          <img className="brandmark-img" src="/growthpulse-icon.svg" alt="" />
          <span className="brandword">Growth<span className="brandword__accent">Pulse</span></span>
        </div>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon />
                {t.id === 'alarms' && alertCount > 0 && <span className="tab__badge">{alertCount}</span>}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}
      {showPlans && <PlansSheet onClose={closePlans} />}
    </div>
  );
}

// Decides what to show based on auth state.
function Gate() {
  const { user, authReady, configured } = useAuth();

  if (!configured) {
    return (
      <div className="login">
        <div className="card center" style={{ maxWidth: 380, margin: '0 auto' }}>
          <p className="muted">GrowthPulse isn't connected to its accounts service yet. Add your Supabase URL and anon key, then reload.</p>
        </div>
      </div>
    );
  }
  if (!authReady) {
    return <div style={{ padding: 80, textAlign: 'center' }} className="muted">Loading...</div>;
  }
  if (!user) return <Login />;

  return (
    <AppProvider key={user.id}>
      <Shell />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
