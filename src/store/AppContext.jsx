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
  { id: 'node-03', name: 'Lab Bench', location: 'Lab', transport: 'wifi', plant: 'aloe-vera' },
];

const EMPTY_READING = { airTemperatureF: null, airHumidity: null, soilTemperatureF: null, soilRaw: null, soilMoisturePercent: null, time: 0 };

function buildDevice(d) {
  // Claimed real devices start with NO data and stay offline until the cloud
  // actually reports a reading. Only demo/sample devices get simulated values.
  const claimed = !!d.losantDeviceId;
  const r = claimed ? { ...EMPTY_READING } : seedReading();
  return {
    ...d,
    // Ethernet was retired; normalize any older saved devices to Wi-Fi.
    transport: d.transport === 'lorawan' ? 'lorawan' : 'wifi',
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

// Map a Supabase devices row into the app's device shape.
function rowToDevice(r) {
  return buildDevice({
    id: r.id,
    name: r.name,
    location: r.location || '',
    geo: r.geo || undefined,
    group: r.grp || undefined,
    transport: r.transport,
    plant: r.plant,
    irrigation: r.irrigation || undefined,
    photo: r.photo || undefined,
    losantDeviceId: r.losant_device_id,
    pairingCode: r.claim_code || undefined,   // shown on the device card so units are never confused
    // When the plant joined this account; the report's "Everything" range
    // and the activity timeline both start here.
    claimedAt: r.created_at ? new Date(r.created_at).getTime() : 0,
  });
}

export function AppProvider({ children }) {
  const { user, logout, isDemo } = useAuth();
  STORAGE_PREFIX = user.id; // each account's data is namespaced by user id
  const [devices, setDevices] = useState(() => {
    // Real accounts are cloud-authoritative: devices load from Supabase in the
    // effect below so plants follow the account onto any browser.
    if (!isDemo) return [];
    const saved = load('devices', null);
    const base = saved && saved.length ? saved : STARTER_DEVICES;
    return base.map(buildDevice);
  });
  const [devicesReady, setDevicesReady] = useState(isDemo);
  // When live polling began. A claimed device that hasn't reported yet reads
  // "Connecting" for a grace window instead of "Offline", so a node that takes
  // a few seconds to check in never flashes Offline on first load.
  const pollStartedAtRef = useRef(Date.now());
  const CONNECTING_GRACE_MS = 15000;
  const isConnecting = useCallback(
    (d) => !!(d && d.losantDeviceId && !d.hasData && Date.now() - pollStartedAtRef.current < CONNECTING_GRACE_MS),
    []
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => load('selectedDeviceId', null));
  const [alarmRules, setAlarmRules] = useState(() => load('alarmRules', DEFAULT_ALARMS));
  const [settings, setSettings] = useState(() => load('settings', { units: 'F', refreshMs: 2000, theme: 'auto' }));
  const [tierId, setTierId] = useState(() => {
    if (isDemo) return 'pro';
    // The account is the source of truth so the plan follows the user to any
    // browser or device; localStorage is just a fast local cache.
    return (user.user_metadata && user.user_metadata.tier) || load('tier', 'free');
  });
  const [showPlans, setShowPlans] = useState(false);
  const [journals, setJournals] = useState(() => load('journals', {}));
  const [gateways, setGateways] = useState(() => load('gateways', []));
  const [weather, setWeather] = useState(null);

  // Live ref so the polling loop always sees the latest device list.
  const devicesRef = useRef(devices);
  devicesRef.current = devices;

  // Load this account's devices from the cloud. Also a one-time migration:
  // claims made before cloud ownership existed are lifted out of this
  // browser's storage into the account, keeping journals and alarms attached.
  useEffect(() => {
    if (isDemo || !supabase) { setDevicesReady(true); return undefined; }
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await supabase.from('devices').select('*').order('created_at');
      if (cancelled) return;
      if (error) { setDevicesReady(true); return; } // can't reach the cloud; app still opens
      let list = (rows || []).map(rowToDevice);

      if (list.length === 0) {
        const saved = (load('devices', []) || []).filter((d) => d.losantDeviceId);
        for (const d of saved) {
          // Recover the unit's claim code from the registry (older local
          // claims stored only the cloud device id).
          const { data: reg } = await supabase
            .from('device_registry').select('claim_code')
            .eq('losant_device_id', d.losantDeviceId).maybeSingle();
          const { data: ins } = await supabase.from('devices').insert({
            claim_code: reg ? reg.claim_code : String(d.losantDeviceId).toUpperCase(),
            losant_device_id: d.losantDeviceId,
            name: d.name || 'My Plant',
            location: d.location || '',
            geo: d.geo || null,
            grp: d.group || null,
            transport: d.transport === 'lorawan' ? 'lorawan' : 'wifi',
            plant: d.plant || 'generic',
            irrigation: d.irrigation || null,
          }).select().single();
          if (ins) {
            list.push(rowToDevice(ins));
            const oldId = d.id;
            // Keep this browser's journals/alarms attached to the new cloud id.
            setJournals((j) => {
              if (!j[oldId]) return j;
              const next = { ...j, [ins.id]: j[oldId] };
              delete next[oldId];
              return next;
            });
            setAlarmRules((rs) => rs.map((r) => (r.deviceId === oldId ? { ...r, deviceId: ins.id } : r)));
            setSelectedDeviceId((sel) => (sel === oldId ? ins.id : sel));
          }
        }
      }
      if (cancelled) return;
      setDevices(list);
      setDevicesReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  // Push device edits up to the cloud (real accounts only).
  const syncDevice = useCallback((id, patch) => {
    if (isDemo || !supabase) return;
    const map = {};
    if ('name' in patch) map.name = patch.name;
    if ('location' in patch) map.location = patch.location;
    if ('geo' in patch) map.geo = patch.geo ?? null;
    if ('group' in patch) map.grp = patch.group ?? null;
    if ('transport' in patch) map.transport = patch.transport;
    if ('plant' in patch) map.plant = patch.plant;
    if ('irrigation' in patch) map.irrigation = patch.irrigation;
    if ('photo' in patch) map.photo = patch.photo ?? null;
    if (Object.keys(map).length === 0) return;
    supabase.from('devices').update(map).eq('id', id).then(() => {});
  }, [isDemo]);

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
            // Freshness window: a Wi-Fi node reports every few seconds, so 45s
            // of silence means it's offline. LoRaWAN reports in minutes.
            const STALE_MS = d.transport === 'lorawan' ? 15 * 60 * 1000 : 45 * 1000;
            const u = updates[d.id];
            if (!u) {
              // Fetch failed or no data; re-evaluate freshness of what we have.
              if (d.online && d.lastSeen && Date.now() - d.lastSeen > STALE_MS) return { ...d, online: false };
              return d;
            }
            const fresh = !!u.time && Date.now() - u.time < STALE_MS;
            const isNew = !!u.time && u.time !== d.lastSeen;
            const reading = { ...d.reading, ...u };
            return {
              ...d,
              reading,
              // Only append genuinely new reports, not re-reads of the same one.
              history: isNew ? [...d.history, reading].slice(-60) : d.history,
              lastSeen: u.time || d.lastSeen,
              online: fresh,
              hasData: true,
            };
          }
          const r = nextReading(d.reading);
          return { ...d, reading: r, history: [...d.history, r].slice(-60), lastSeen: r.time };
        })
      );
    };
    pollStartedAtRef.current = Date.now(); // start the "Connecting" grace window
    tick(); // poll once right away so we don't wait a full interval to show data
    const id = setInterval(tick, settings.refreshMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [settings.refreshMs]);

  // Persist settings whenever they change, so nothing resets on refresh.
  useEffect(() => save('alarmRules', alarmRules), [alarmRules]);
  useEffect(() => save('selectedDeviceId', selectedDeviceId), [selectedDeviceId]);
  useEffect(() => save('settings', settings), [settings]);
  useEffect(() => save('tier', tierId), [tierId]);
  useEffect(() => save('journals', journals), [journals]);
  useEffect(() => save('gateways', gateways), [gateways]);

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
    // Weather follows the plant's own home location. Location is optional: we
    // never prompt the browser for the user's position and never invent a
    // default city. If this plant has no location, weather simply reports
    // "needs location" and the card invites the user to add one — purely so
    // customers who don't want to share where they live aren't forced to.
    if (pinnedGeo) {
      fetchFor(pinnedGeo.lat, pinnedGeo.lon, pinnedGeo.label);
    } else {
      setWeather({ needsLocation: true });
    }
    return () => { cancelled = true; };
  }, [settings.units, pinnedGeo && pinnedGeo.lat, pinnedGeo && pinnedGeo.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  // Demo devices persist in the browser; real accounts persist in the cloud.
  const deviceSig = devices.map((d) => `${d.id}|${d.name}|${d.location}|${d.transport}|${d.plant}|${JSON.stringify(d.irrigation)}|${d.losantDeviceId || ''}|${d.geo ? d.geo.lat + ',' + d.geo.lon : ''}|${d.group || ''}|${d.photo ? d.photo.length : 0}`).join(',');
  useEffect(() => {
    if (!isDemo) return;
    save('devices', devices.map((d) => ({ id: d.id, name: d.name, location: d.location, transport: d.transport, plant: d.plant, irrigation: d.irrigation, losantDeviceId: d.losantDeviceId, geo: d.geo, group: d.group, photo: d.photo })));
  }, [deviceSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const addDevice = useCallback((name, location, transport) => {
    const id = 'node-' + Math.random().toString(36).slice(2, 6);
    setDevices((ds) => [...ds, buildDevice({ id, name, location, transport })]);
    setSelectedDeviceId(id);
  }, []);

  // Claim a real device by its short pairing code. Looks the code up in the
  // device registry; only a code that maps to a real unit is accepted.
  const claimDevice = useCallback(async (code, name, place, transport) => {
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
    // The claim lives in the account, not this browser. claim_code is UNIQUE,
    // so a unit can only ever belong to one account at a time.
    const { data: ins, error: insErr } = await supabase.from('devices').insert({
      claim_code: claimCode,
      losant_device_id: data.losant_device_id,
      name: name || 'My Plant',
      location: geo ? geo.label : (place || '').trim(),
      geo: geo || null,
      transport: transport === 'lorawan' ? 'lorawan' : 'wifi',
      plant: 'generic',
    }).select().single();
    if (insErr) {
      if (insErr.code === '23505') return 'That unit is already claimed by another account. Its owner can release it under Edit device.';
      return 'Could not save the device. Check your connection and try again.';
    }
    setDevices((ds) => [...ds, rowToDevice(ins)]);
    setSelectedDeviceId(ins.id);
    return null;
  }, []);

  const setDevicePlant = useCallback((id, plant) => {
    setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, plant } : d)));
    syncDevice(id, { plant });
  }, [syncDevice]);

  const updateDevice = useCallback((id, patch) => {
    setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    syncDevice(id, patch);
  }, [syncDevice]);
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
    // Releasing the claim in the cloud frees the unit for a new owner.
    if (!isDemo && supabase) supabase.from('devices').delete().eq('id', id).then(() => {});
  }, [isDemo]);

  // Factory reset for resale: tell the unit (via the cloud) to wipe its own
  // Wi-Fi and reboot into setup mode, then remove it from this account.
  // If the unit is offline the command is lost, the new owner can still
  // hold PRG for 3 seconds as the manual fallback.
  const factoryResetDevice = useCallback(async (id) => {
    const d = devicesRef.current.find((x) => x.id === id);
    if (d && d.losantDeviceId) {
      try {
        // The signed-in session rides along so the backend can verify this
        // account actually owns the unit before sending the command.
        let headers = {};
        if (supabase) {
          const { data: sess } = await supabase.auth.getSession();
          if (sess && sess.session) headers = { Authorization: `Bearer ${sess.session.access_token}` };
        }
        await fetch(`/.netlify/functions/device-command?deviceId=${encodeURIComponent(d.losantDeviceId)}&name=factoryReset`, { method: 'POST', headers });
      } catch {
        // unreachable; manual PRG fallback still works
      }
    }
    removeDevice(id);
  }, [removeDevice]);

  const setIrrigation = useCallback((id, patch) => {
    setDevices((ds) => ds.map((d) => {
      if (d.id !== id) return d;
      const irrigation = { ...d.irrigation, ...patch };
      syncDevice(id, { irrigation });
      return { ...d, irrigation };
    }));
  }, [syncDevice]);
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

  // LoRaWAN gateways: the one piece of Farm Kit hardware that touches the
  // internet. Nodes join through them automatically; the app just tracks them.
  const addGateway = useCallback((name, code) => {
    const id = 'gw-' + Math.random().toString(36).slice(2, 6);
    setGateways((gs) => [...gs, { id, name: name || 'My Gateway', code: (code || '').toUpperCase(), addedAt: Date.now() }]);
  }, []);
  const removeGateway = useCallback((id) => {
    setGateways((gs) => gs.filter((g) => g.id !== id));
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

  const setTier = useCallback((id) => {
    setTierId(id);
    // Persist the plan on the account (not just this browser) so it survives
    // logout and follows the user to any device. localStorage stays as a cache.
    if (!isDemo && supabase) {
      supabase.auth.updateUser({ data: { tier: id } }).catch(() => {});
    }
  }, [isDemo]);
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
    devices, devicesReady, isConnecting, selectedDevice, selectedDeviceId, setSelectedDeviceId, addDevice, claimDevice, setDevicePlant, updateDevice, removeDevice, factoryResetDevice, setIrrigation, runPump, isDemo,
    alarmRules, addAlarmRule, addAlarmRules, updateAlarmRule, removeAlarmRule,
    settings, updateSettings,
    tier: TIERS[tierId] || TIERS.free, tierId, setTier, showPlans, openPlans, closePlans,
    journals, addJournalEntry, removeJournalEntry, weather,
    gateways, addGateway, removeGateway,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
