import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { seedReading, nextReading } from './helpers';
import { TIERS } from './tiers';

/* ============================================================
   AppContext
   One shared "store" that every screen reads from: the logged-in
   user, all devices (with live data), the selected device, and
   the alarm rules. The live timer ticks every 2s, matching the
   node's send rate.
   ============================================================ */

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// --- tiny localStorage persistence so settings survive a refresh ---
const KEY = 'growthpulse';
function load(name, fallback) {
  try {
    const raw = localStorage.getItem(`${KEY}:${name}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(name, value) {
  try {
    localStorage.setItem(`${KEY}:${name}`, JSON.stringify(value));
  } catch {
    // storage unavailable, ignore
  }
}

const STARTER_DEVICES = [
  { id: 'node-01', name: 'Greenhouse Node', location: 'Greenhouse A', transport: 'wifi', plant: 'boston-fern' },
  { id: 'node-02', name: 'Field Sensor', location: 'North Field', transport: 'lorawan', plant: 'tomato' },
  { id: 'node-03', name: 'Lab Bench', location: 'Lab', transport: 'ethernet', plant: 'aloe-vera' },
];

function buildDevice(d) {
  const r = seedReading();
  return { ...d, plant: d.plant || 'generic', online: true, reading: r, history: [r], lastSeen: r.time };
}

const DEFAULT_ALARMS = [
  { id: 'a1', metric: 'soilMoisturePercent', op: 'below', value: 25, enabled: true },
  { id: 'a2', metric: 'airTemperatureF', op: 'above', value: 85, enabled: true },
  { id: 'a3', metric: 'airHumidity', op: 'below', value: 30, enabled: false },
];

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => load('user', null));
  const [devices, setDevices] = useState(() => {
    const saved = load('devices', null);
    const base = saved && saved.length ? saved : STARTER_DEVICES;
    return base.map(buildDevice);
  });
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => load('selectedDeviceId', STARTER_DEVICES[0].id));
  const [alarmRules, setAlarmRules] = useState(() => load('alarmRules', DEFAULT_ALARMS));
  const [settings, setSettings] = useState(() => load('settings', { units: 'F', refreshMs: 2000, theme: 'auto' }));
  const [tierId, setTierId] = useState(() => load('tier', 'free'));
  const [showPlans, setShowPlans] = useState(false);

  // Live simulation: advance every device's reading every 2 seconds.
  useEffect(() => {
    const id = setInterval(() => {
      setDevices((ds) =>
        ds.map((d) => {
          const r = nextReading(d.reading);
          return { ...d, reading: r, history: [...d.history, r].slice(-60), lastSeen: r.time };
        })
      );
    }, settings.refreshMs);
    return () => clearInterval(id);
  }, [settings.refreshMs]);

  // Persist settings whenever they change, so nothing resets on refresh.
  useEffect(() => save('user', user), [user]);
  useEffect(() => save('alarmRules', alarmRules), [alarmRules]);
  useEffect(() => save('selectedDeviceId', selectedDeviceId), [selectedDeviceId]);
  useEffect(() => save('settings', settings), [settings]);
  useEffect(() => save('tier', tierId), [tierId]);
  const deviceSig = devices.map((d) => `${d.id}|${d.name}|${d.location}|${d.transport}|${d.plant}`).join(',');
  useEffect(() => {
    save('devices', devices.map((d) => ({ id: d.id, name: d.name, location: d.location, transport: d.transport, plant: d.plant })));
  }, [deviceSig]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const setDevicePlant = useCallback((id, plant) => {
    setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, plant } : d)));
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

  const updateSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  const setTier = useCallback((id) => setTierId(id), []);
  const openPlans = useCallback(() => setShowPlans(true), []);
  const closePlans = useCallback(() => setShowPlans(false), []);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];

  const value = {
    user, login, logout,
    devices, selectedDevice, selectedDeviceId, setSelectedDeviceId, addDevice, setDevicePlant,
    alarmRules, addAlarmRule, updateAlarmRule, removeAlarmRule,
    settings, updateSettings,
    tier: TIERS[tierId] || TIERS.free, tierId, setTier, showPlans, openPlans, closePlans,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
