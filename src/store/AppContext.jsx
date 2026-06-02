import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { seedReading, nextReading } from './helpers';

/* ============================================================
   AppContext
   One shared "store" that every screen reads from: the logged-in
   user, all devices (with live data), the selected device, and
   the alarm rules. The live timer ticks every 2s, matching the
   node's send rate.
   ============================================================ */

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const STARTER_DEVICES = [
  { id: 'node-01', name: 'Greenhouse Node', location: 'Greenhouse A', transport: 'wifi' },
  { id: 'node-02', name: 'Field Sensor', location: 'North Field', transport: 'lorawan' },
  { id: 'node-03', name: 'Lab Bench', location: 'Lab', transport: 'ethernet' },
];

function buildDevice(d) {
  const r = seedReading();
  return { ...d, online: true, reading: r, history: [r], lastSeen: r.time };
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [devices, setDevices] = useState(() => STARTER_DEVICES.map(buildDevice));
  const [selectedDeviceId, setSelectedDeviceId] = useState(STARTER_DEVICES[0].id);
  const [alarmRules, setAlarmRules] = useState([
    { id: 'a1', metric: 'soilMoisturePercent', op: 'below', value: 25, enabled: true },
    { id: 'a2', metric: 'airTemperatureF', op: 'above', value: 85, enabled: true },
    { id: 'a3', metric: 'airHumidity', op: 'below', value: 30, enabled: false },
  ]);

  // Live simulation: advance every device's reading every 2 seconds.
  useEffect(() => {
    const id = setInterval(() => {
      setDevices((ds) =>
        ds.map((d) => {
          const r = nextReading(d.reading);
          return { ...d, reading: r, history: [...d.history, r].slice(-60), lastSeen: r.time };
        })
      );
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const login = useCallback((email) => {
    const name = (email || 'demo@growthpulse.io').split('@')[0];
    setUser({ email: email || 'demo@growthpulse.io', name });
  }, []);
  const logout = useCallback(() => setUser(null), []);

  const addDevice = useCallback((name, location, transport) => {
    const id = 'node-' + Math.random().toString(36).slice(2, 6);
    setDevices((ds) => [...ds, buildDevice({ id, name, location, transport })]);
    setSelectedDeviceId(id);
  }, []);

  const updateAlarmRule = useCallback((id, patch) => {
    setAlarmRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);
  const addAlarmRule = useCallback((rule) => {
    setAlarmRules((rs) => [...rs, { id: 'a' + Date.now(), enabled: true, ...rule }]);
  }, []);
  const removeAlarmRule = useCallback((id) => {
    setAlarmRules((rs) => rs.filter((r) => r.id !== id));
  }, []);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];

  const value = {
    user, login, logout,
    devices, selectedDevice, selectedDeviceId, setSelectedDeviceId, addDevice,
    alarmRules, addAlarmRule, updateAlarmRule, removeAlarmRule,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
