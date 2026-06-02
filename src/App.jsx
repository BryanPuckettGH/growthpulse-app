import { useState } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import Login from './components/Login';
import LiveView from './views/LiveView';
import HistoryView from './views/HistoryView';
import AlarmsView from './views/AlarmsView';
import DevicesView from './views/DevicesView';
import { activeAlerts } from './store/helpers';
import { Activity, LineChart, Bell, LayoutGrid, ChevronDown } from 'lucide-react';

const TABS = [
  { id: 'live', label: 'Live', icon: Activity, View: LiveView },
  { id: 'history', label: 'History', icon: LineChart, View: HistoryView },
  { id: 'alarms', label: 'Alarms', icon: Bell, View: AlarmsView },
  { id: 'devices', label: 'Devices', icon: LayoutGrid, View: DevicesView },
];

function Shell() {
  const { user, logout, selectedDevice, devices, alarmRules } = useApp();
  const [tab, setTab] = useState('live');
  const [accountOpen, setAccountOpen] = useState(false);

  if (!user) return <Login />;

  const ActiveView = TABS.find((t) => t.id === tab).View;
  const alertCount = activeAlerts(devices, alarmRules).length;

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
        <button className="iconbtn avatar" title="Account" onClick={() => setAccountOpen(true)}>
          {user.name.charAt(0).toUpperCase()}
        </button>
      </div>

      <div className="content">
        <ActiveView />
      </div>

      <div className="tabbar">
        <div className="tabbar__brand"><img className="brandmark-img" src="/growthpulse-icon.svg" alt="" /><span className="brandword">Growth<span className="brandword__accent">Pulse</span></span></div>
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

      {accountOpen && <AccountSheet user={user} onClose={() => setAccountOpen(false)} onLogout={logout} />}
    </div>
  );
}

function AccountSheet({ user, onClose, onLogout }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Account</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div className="avatar-lg">{user.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 700 }}>{user.name}</div>
            <div className="muted">{user.email}</div>
          </div>
        </div>
        <button className="btn btn--ghost" onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
