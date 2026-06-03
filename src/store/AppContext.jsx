import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { seedReading, nextReading } from './helpers';
import { TIERS } from './tiers';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../supabaseClient';
import { geocodePlace } from '../utils/geocode';

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
// Set per logged-in user so each account's saved data is kept separate.
let STORAGE_PREFIX = 'anon';
function load(name, fallback) {
  try {
    const raw = localStorage.getItem(`${KEY}:${STORAGE_PREFIX}:${name}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(name, value) {
  try {
    localStorage.setItem(`${KEY}:${STORAGE_PREFIX}:${name}`, JSON.stringify(value));
  } catch {
    // storage unavailable, ignore
  }
}

const STARTER_DEVICES = [
  { id: 'node-01', name: 'Greenhouse Node', location: 'Greenhouse A', transport: 'wifi', plant: 'boston-fern' },
  { id: 'node-02', name: 'Field Sensor', location: 'North Field', transport: 'lorawan', plant: 'tomato' },
  { id: 'node-03', name: 'Lab Bench', location: 'Lab', transport: 'ethernet', plant: 'aloe-vera' },
];

const EMPTY_READING = { airTemperatureF: null, airHumidity: null, soilTemperatureF: null, soilRaw: null, soilMoisturePercent: null, time: 0 };

function buildDevice(d) {
  // Claimed real devices start with NO data and stay offline until the cloud
  // actually reports a reading. Only demo/sample devices get simulated values.
  const claimed = !!d.losantDeviceId;
  const r = claimed ? { ...EMPTY_READING } : seedReading();
  return {
    ...d,
    plant: d.plant || 'generic',
    irrigation: d.irrigation || { mode: 'manual', targetMoisture: 35, durationSec: 5, enabled: false },
    pumpRunning: false,
    hasData: !claimed,
    online: !claimed,
    reading: r,
    history: claimed ? [] : [r],
    lastSeen: claimed ? 0 : r.time,
  };
}

const DEFAULT_ALARMS = [
  { id: 'a1', metric: 'soilMoisturePercent', op: 'below', value: 25, enabled: true, deviceId: 'all' },
  { id: 'a2', metric: 'airTemperatureF', op: 'above', value: 85, enabled: true, deviceId: 'all' },
  { id: 'a3', metric: 'airHumidity', op: 'below', value: 30, enabled: false, deviceId: 'all' },
];

export function AppProvider({ children }) {
  const { user, logout, isDemo } = useAuth();
  STORAGE_PREFIX = user.id; // each account's data is namespaced by user id
  const [devices, setDevices] = useState(() => {
    const saved = load('devices', null);
    // Real accounts start empty (onboarding prompts to connect a device).
    // Demo mode seeds sample devices so prospects can explore everything.
    const base = saved && saved.length ? saved : (isDemo ? STARTER_DEVICES : []);
    return base.map(buildDevice);
  });
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => load('selectedDeviceId', null));
  const [alarmRules, setAlarmRules] = useState(() => load('alarmRules', DEFAULT_ALARMS));
  const [settings, setSettings] = useState(() => load('settings', { units: 'F', refreshMs: 2000, theme: 'auto' }));
  const [tierId, setTierId] = useState(() => load('tier', isDemo ? 'pro' : 'free'));
  const [showPlans, setShowPlans] = useState(false);
  const [journals, setJournals] = useState(() => load('journals', {}));
  const [weather, setWeather] = useState(null);

  // Live ref so the polling loop always sees the latest device list.
  const devicesRef = useRef(devices);
  devicesRef.current = devices;

  // Live loop: claimed devices (with a losantDeviceId) pull REAL readings from
  // the cloud connector; demo/sample devices advance simulated readings.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const claimed = devicesRef.current.filter((d) => d.losantDeviceId);
      const updates = {};
      await Promise.all(claimed.map(async (d) => {
        try {
          const res = await fetch(`/.netlify/functions/device-state?deviceId=${encodeURIComponent(d.losantDeviceId)}`);
          if (res.ok) {
            const r = await res.json();
            if (r && r.soilMoisturePercent != null) updates[d.id] = r;
          }
        } catch {
          // ignore; keep the last reading
        }
      }));
      if (cancelled) return;
      setDevices((ds) =>
        ds.map((d) => {
          if (d.losantDeviceId) {
            const u = updates[d.id];
            if (!u) return d;
            const reading = { ...d.reading, ...u };
            return { ...d, reading, history: [...d.history, reading].slice(-60), lastSeen: u.time || Date.now(), online: true, hasData: true };
          }
          const r = nextReading(d.reading);
          return { ...d, reading: r, history: [...d.history, r].slice(-60), lastSeen: r.time };
        })
      );
    };
    const id = setInterval(tick, settings.refreshMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [settings.refreshMs]);

  // Persist settings whenever they change, so nothing resets on refresh.
  useEffect(() => save('alarmRules', alarmRules), [alarmRules]);
  useEffect(() => save('selectedDeviceId', selectedDeviceId), [selectedDeviceId]);
  useEffect(() => save('settings', settings), [settings]);
  useEffect(() => save('tier', tierId), [tierId]);
  useEffect(() => save('journals', journals), [journals]);

  // Shared weather (virtual rain gauge), used by the weather card and rain alarms.
  // Pinned to the selected device's HOME location when it has one, so the
  // forecast follows the plant, not the owner's phone on vacation.
  const selectedForWeather = devices.find((d) => d.id === selectedDeviceId) || devices[0];
  const pinnedGeo = selectedForWeather ? selectedForWeather.geo : null;
  useEffect(() => {
    let cancelled = false;
    const unit = settings.units === 'C' ? 'celsius' : 'fahrenheit';
    const fetchFor = (lat, lon, label) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=precipitation_probability_max,temperature_2m_max,uv_index_max&temperature_unit=${unit}&timezone=auto&forecast_days=1`;
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setWeather({
            label,
            pinned: !!pinnedGeo,
            temp: Math.round(d.current.temperature_2m),
            code: d.current.weather_code,
            rainChance: d.daily.precipitation_probability_max?.[0] ?? 0,
            uv: d.daily.uv_index_max?.[0] ?? 0,
            high: Math.round(d.daily.temperature_2m_max?.[0] ?? 0),
          });
        })
        .catch(() => { if (!cancelled) setWeather({ error: true }); });
    };
    const DEF = { lat: 25.7617, lon: -80.1918, label: 'Miami, FL' };
    if (pinnedGeo) {
      fetchFor(pinnedGeo.lat, pinnedGeo.lon, pinnedGeo.label);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchFor(pos.coords.latitude, pos.coords.longitude, 'Your location'),
        () => fetchFor(DEF.lat, DEF.lon, DEF.label),
        { timeout: 5000 }
      );
    } else {
      fetchFor(DEF.lat, DEF.lon, DEF.label);
    }
    return () => { cancelled = true; };
  }, [settings.units, pinnedGeo && pinnedGeo.lat, pinnedGeo && pinnedGeo.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  const deviceSig = devices.map((d) => `${d.id}|${d.name}|${d.location}|${d.transport}|${d.plant}|${JSON.stringify(d.irrigation)}|${d.losantDeviceId || ''}|${d.geo ? d.geo.lat + ',' + d.geo.lon : ''}`).join(',');
  useEffect(() => {
    save('devices', devices.map((d) => ({ id: d.id, name: d.name, location: d.location, transport: d.transport, plant: d.plant, irrigation: d.irrigation, losantDeviceId: d.losantDeviceId, geo: d.geo })));
  }, [deviceSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const addDevice = useCallback((name, location, transport) => {
    const id = 'node-' + Math.random().toString(36).slice(2, 6);
    setDevices((ds) => [...ds, buildDevice({ id, name, location, transport })]);
    setSelectedDeviceId(id);
  }, []);

  // Claim a real device by its short pairing code. Looks the code up in the
  // device registry; only a code that maps to a real unit is accepted.
  const claimDevice = useCallback(async (code, name, place) => {
    const claimCode = (code || '').trim().toUpperCase();
    if (!claimCode) return 'Enter the pairing code from your device.';
    if (!supabase) return 'Accounts service unavailable.';
    const { data, error } = await supabase
      .from('device_registry')
      .select('losant_device_id')
      .eq('claim_code', claimCode)
      .maybeSingle();
    if (error || !data) return 'That pairing code wasn’t recognized. Double-check the code on your unit.';
    // Pin the plant to its real home so weather stays correct even when the
    // owner is traveling. Geocode failure is non-fatal; weather falls back.
    const geo = place && place.trim() ? await geocodePlace(place.trim()) : null;
    const id = 'node-' + Math.random().toString(36).slice(2, 6);
    setDevices((ds) => [...ds, buildDevice({
      id,
      name: name || 'My Plant',
      location: geo ? geo.label : (place || '').trim(),
      transport: 'wifi',
      plant: 'generic',
      losantDeviceId: data.losant_device_id,
      geo: geo || undefined,
    })]);
    setSelectedDeviceId(id);
    return null;
  }, []);

  const setDevicePlant = useCallback((id, plant) => {
    setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, plant } : d)));
  }, []);

  const updateDevice = useCallback((id, patch) => {
    setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);
  // Removing a device also purges everything tied to it (journal, photos,
  // device-specific alarms) so a resold unit leaves nothing behind.
  const removeDevice = useCallback((id) => {
    setDevices((ds) => ds.filter((d) => d.id !== id));
    setJournals((j) => {
      const next = { ...j };
      delete next[id];
      return next;
    });
    setAlarmRules((rs) => rs.filter((r) => r.deviceId !== id));
  }, []);

  const setIrrigation = useCallback((id, patch) => {
    setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, irrigation: { ...d.irrigation, ...patch } } : d)));
  }, []);
  const runPump = useCallback((id, seconds = 5) => {
    setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, pumpRunning: true } : d)));
    setTimeout(() => {
      setDevices((ds) => ds.map((d) => {
        if (d.id !== id) return d;
        const reading = {
          ...d.reading,
          soilRaw: Math.max(1300, d.reading.soilRaw - 600),
          soilMoisturePercent: Math.min(100, d.reading.soilMoisturePercent + 25),
        };
        return { ...d, pumpRunning: false, reading };
      }));
    }, Math.min(seconds, 6) * 1000);
  }, []);

  const addJournalEntry = useCallback((deviceId, entry) => {
    setJournals((j) => ({ ...j, [deviceId]: [{ id: 'e' + Date.now(), date: Date.now(), ...entry }, ...(j[deviceId] || [])] }));
  }, []);
  const removeJournalEntry = useCallback((deviceId, entryId) => {
    setJournals((j) => ({ ...j, [deviceId]: (j[deviceId] || []).filter((e) => e.id !== entryId) }));
  }, []);

  const updateAlarmRule = useCallback((id, patch) => {
    setAlarmRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);
  const addAlarmRule = useCallback((rule) => {
    setAlarmRules((rs) => [...rs, { id: 'a' + Date.now(), enabled: true, deviceId: 'all', ...rule }]);
  }, []);
  const addAlarmRules = useCallback((rules) => {
    setAlarmRules((rs) => [...rs, ...rules.map((r, i) => ({ id: 'a' + Date.now() + '-' + i, enabled: true, deviceId: 'all', ...r }))]);
  }, []);
  const removeAlarmRule = useCallback((id) => {
    setAlarmRules((rs) => rs.filter((r) => r.id !== id));
  }, []);

  const updateSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  const setTier = useCallback((id) => setTierId(id), []);
  const openPlans = useCallback(() => setShowPlans(true), []);
  const closePlans = useCallback(() => setShowPlans(false), []);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];

  // Prefer the real name from signup metadata; fall back to the email prefix.
  const meta = user.user_metadata || {};
  const displayName = meta.first_name
    ? `${meta.first_name} ${meta.last_name || ''}`.trim()
    : (user.email || 'user').split('@')[0];

  const value = {
    user: { id: user.id, email: user.email, name: displayName, growerType: meta.grower_type || '' }, logout,
    devices, selectedDevice, selectedDeviceId, setSelectedDeviceId, addDevice, claimDevice, setDevicePlant, updateDevice, removeDevice, setIrrigation, runPump, isDemo,
    alarmRules, addAlarmRule, addAlarmRules, updateAlarmRule, removeAlarmRule,
    settings, updateSettings,
    tier: TIERS[tierId] || TIERS.free, tierId, setTier, showPlans, openPlans, closePlans,
    journals, addJournalEntry, removeJournalEntry, weather,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
