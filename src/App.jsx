import { useState } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import Login from './components/Login';
import LiveView from './views/LiveView';
import HistoryView from './views/HistoryView';
import AlarmsView from './views/AlarmsView';
import DevicesView from './views/DevicesView';
import { activeAlerts } from './store/helpers';
import { Activity, LineChart, Bell, LayoutGrid, ChevronDown, Settings } from 'lucide-react';

const TABS = [
  { id: 'live', label: 'Live', icon: Activity, View: LiveView },
  { id: 'history', label: 'History', icon: LineChart, View: HistoryView },
  { id: 'alarms', label: 'Alarms', icon: Bell, View: AlarmsView },
  { id: 'devices', label: 'Devices', icon: LayoutGrid, View: DevicesView },
];

function Shell() {
  const { user, selectedDevice, devices, alarmRules } = useApp();
  const [tab, setTab] = useState('live');

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
        <button className="iconbtn" title="Settings"><Settings size={18} /></button>
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
