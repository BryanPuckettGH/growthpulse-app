import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { TRANSPORTS, timeAgo, effectiveTransport, metricConnected, signalInfo, signalLabel } from '../store/helpers';
import { TransportIcon, PowerBadge } from '../components/UI';
import { geocodePlace } from '../utils/geocode';
import { fileToThumb } from '../utils/image';
import { Plus, Sprout, Lock, Pencil, Trash2, RefreshCcw, AlertTriangle, MapPin, RadioTower, Camera, QrCode } from 'lucide-react';
import AddDeviceSheet from '../components/AddDeviceSheet';
import ClaimDeviceSheet from '../components/ClaimDeviceSheet';
import DeviceAvatar from '../components/DeviceAvatar';
import QrScanner from '../components/QrScanner';
import ImageCropper from '../components/ImageCropper';

// List of all devices (tap to select) plus add/claim, gateways, and full
// device management: rename, home location, delete, and factory reset.
export default function DevicesView() {
  const { devices, selectedDeviceId, setSelectedDeviceId, addDevice, claimDevice, tier, openPlans, isDemo, gateways, addGateway, removeGateway, isConnecting } = useApp();
  const [open, setOpen] = useState(false);
  const [gwOpen, setGwOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const atLimit = devices.length >= tier.deviceLimit;

  // Optional grouping: devices with a group render under their group's
  // heading; ungrouped ones go under "Other plants" (or flat if no groups).
  const groupNames = [...new Set(devices.map((d) => d.group).filter(Boolean))];
  const ungrouped = devices.filter((d) => !d.group);

  const card = (d) => {
    const t = TRANSPORTS[effectiveTransport(d)] || TRANSPORTS.wifi;
    const sig = signalLabel(signalInfo(d));
    // For a grace window after load, a claimed device that hasn't reported yet
    // is "Connecting", not "Offline" (don't scare people into refreshing).
    const connecting = isConnecting(d);
    return (
      <div key={d.id} className={`device ${d.id === selectedDeviceId ? 'selected' : ''}`} onClick={() => setSelectedDeviceId(d.id)}>
        <DeviceAvatar device={d} fallbackColor={t.color} />
        <div className="device__main">
          <div className="device__name">{d.name}</div>
          <div className="device__meta">
            <span className="badge"><TransportIcon name={t.icon} color={t.color} />{t.label}{sig && ` · ${sig}`}</span>
            <PowerBadge reading={d.reading} compact />
            <span>
              <span className="dot" style={{ background: d.online ? '#2ecc71' : connecting ? '#f4a52b' : '#cfd3d8', marginRight: 5 }} />
              {d.online ? 'Online' : connecting ? 'Connecting…' : d.hasData ? `Offline · ${timeAgo(d.lastSeen)}` : 'Offline'}
            </span>
            {d.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={11} />{d.location}</span>}
            {d.pairingCode && <span className="device__code">#{d.pairingCode}</span>}
          </div>
        </div>
        <div className="device__reading">
          <div className="device__big">
            {d.hasData ? (metricConnected('soilMoisturePercent', d.reading) ? `${d.reading.soilMoisturePercent}%` : '—') : '—'}
          </div>
          <div className="device__small">
            {!d.hasData ? (connecting ? 'connecting' : 'offline') : metricConnected('soilMoisturePercent', d.reading) ? 'moisture' : 'no probe'}
          </div>
        </div>
        <button className="device__edit" onClick={(e) => { e.stopPropagation(); setEditId(d.id); }} aria-label="Edit device"><Pencil size={16} /></button>
      </div>
    );
  };

  return (
    <div>
      <div className="section-title">Your devices ({devices.length}{tier.deviceLimit < 99 ? ` of ${tier.deviceLimit}` : ''})</div>

      {groupNames.length === 0 ? (
        <div className="cardgrid">{devices.map(card)}</div>
      ) : (
        <>
          {groupNames.map((g) => (
            <div key={g}>
              <div className="section-title" style={{ marginTop: 10 }}>{g}</div>
              <div className="cardgrid">{devices.filter((d) => d.group === g).map(card)}</div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 10 }}>Other plants</div>
              <div className="cardgrid">{ungrouped.map(card)}</div>
            </>
          )}
        </>
      )}

      {atLimit ? (
        <button className="btn btn--ghost" style={{ marginTop: 6 }} onClick={openPlans}>
          <Lock size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Device limit reached, upgrade for more
        </button>
      ) : (
        <button className="btn btn--green" style={{ marginTop: 6 }} onClick={() => setOpen(true)}>
          <Plus size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Add device
        </button>
      )}

      <div className="section-title">Your gateways</div>
      {gateways.length > 0 && (
        <div className="cardgrid">
          {gateways.map((g) => (
            <div key={g.id} className="device" style={{ cursor: 'default' }}>
              <div className="device__avatar" style={{ background: '#a06bff1a' }}><RadioTower size={22} color="#a06bff" /></div>
              <div className="device__main">
                <div className="device__name">{g.name}</div>
                <div className="device__meta">
                  <span className="badge" style={{ color: '#a06bff' }}><RadioTower size={13} color="#a06bff" />Gateway</span>
                  <span><span className="dot" style={{ background: '#2ecc71', marginRight: 5 }} />Linked</span>
                  <span>EUI {g.code}</span>
                </div>
              </div>
              <button className="device__edit" onClick={() => removeGateway(g.id)} aria-label="Remove gateway"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12.5, margin: '2px 4px 8px' }}>
        A gateway lets LoRaWAN nodes work miles from your router, perfect for fields and far greenhouses.
        It's the only Farm Kit piece that touches the internet; nodes join through it automatically.
      </p>
      <button className="btn btn--ghost" onClick={() => setGwOpen(true)}>
        <RadioTower size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Add a LoRaWAN gateway
      </button>

      {open && (isDemo
        ? <AddDeviceSheet onClose={() => setOpen(false)} onAdd={addDevice} />
        : <ClaimDeviceSheet onClose={() => setOpen(false)} onClaim={claimDevice} />)}
      {gwOpen && <GatewaySheet onClose={() => setGwOpen(false)} onAdd={addGateway} />}
      {editId && devices.find((d) => d.id === editId) && (
        <DeviceEditSheet device={devices.find((d) => d.id === editId)} onClose={() => setEditId(null)} />
      )}
    </div>
  );
}

function GatewaySheet({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [eui, setEui] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  // The Gateway EUI is the 16 hex-digit ID on the label's "EUI:" line (colons
  // optional). It's the identifier a LoRaWAN network server registers. The
  // label's QR bundles it with the two MACs and the serial, so a scan extracts
  // just the EUI (see utils/eui.js).
  const submit = () => {
    const hex = eui.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    if (hex.length !== 16) {
      setError('The Gateway EUI is 16 hex characters. Scan the label QR, or copy the "EUI:" line (colons are fine).');
      return;
    }
    const pretty = hex.match(/.{2}/g).join(':'); // E4:38:19:FF:FE:2A:58:80
    onAdd(name.trim() || 'My Gateway', pretty);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Add a LoRaWAN gateway</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Plug the gateway into your router with the included cable (or set up its Wi-Fi). Then add its
          <b> Gateway EUI</b>, the ID on the label's <b>EUI:</b> line (for the ThinkNode G1 it looks like
          <code> e4:38:19:ff:fe:2a:58:80</code>). Scan the label's QR or type it. Nodes within range join automatically.
        </p>

        <div className="fieldlabel">Gateway name</div>
        <input className="input" placeholder="e.g. Barn Gateway" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="fieldlabel">Gateway EUI</div>
        <button className="btn btn--ghost" style={{ marginBottom: 8 }} onClick={() => { setError(''); setScanning(true); }}>
          <QrCode size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Scan QR on the label
        </button>
        <input className="input" placeholder="or type e4:38:19:ff:fe:2a:58:80" value={eui} onChange={(e) => setEui(e.target.value)} autoCapitalize="characters" />

        {error && <p className="center" style={{ color: 'var(--red)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

        <button className="btn btn--green" onClick={submit}>Add gateway</button>
      </div>

      {scanning && (
        <QrScanner
          onResult={(found) => { setEui(found); setScanning(false); }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

function DeviceEditSheet({ device, onClose }) {
  const { updateDevice, removeDevice, factoryResetDevice, provisionLoRaWAN, switchToWiFi, devices } = useApp();
  const [name, setName] = useState(device.name);
  const [location, setLocation] = useState(device.location);
  const [transport, setTransport] = useState(device.transport);
  const [group, setGroup] = useState(device.group || '');
  const [photo, setPhoto] = useState(device.photo || null);
  const [cropSrc, setCropSrc] = useState(null); // image awaiting crop
  const groupSuggestions = [...new Set(devices.map((x) => x.group).filter(Boolean))];
  const [busy, setBusy] = useState(false);
  const [lwMsg, setLwMsg] = useState(''); // LoRaWAN provisioning feedback
  const [confirm, setConfirm] = useState(null); // null | 'remove' | 'reset'

  const onPickPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // let the same file be re-picked later
    if (!file) return;
    // Downscale to a sane working size, then let the user crop it square.
    setCropSrc(await fileToThumb(file, 1280));
  };

  const save = async () => {
    setBusy(true);
    setLwMsg('');
    let patch = { name: name.trim() || device.name, transport, group: group.trim() || undefined };
    if (photo !== (device.photo || null)) patch.photo = photo || null;
    const loc = location.trim();
    if (loc && loc !== device.location) {
      // Re-pin the plant's home: geocode the new place for weather.
      const geo = await geocodePlace(loc);
      patch = geo ? { ...patch, location: geo.label, geo } : { ...patch, location: loc };
    } else if (!loc) {
      patch = { ...patch, location: '', geo: undefined };
    }
    updateDevice(device.id, patch);
    // Switching a real, online node to LoRaWAN actually provisions it: the
    // backend mints a TTS device + keys and pushes them to the board, which
    // reboots and joins. Keep the sheet open to report the result.
    if (transport === 'lorawan' && device.transport !== 'lorawan' && !isDemoDevice(device)) {
      setLwMsg('Setting up LoRaWAN… the node will switch over in about a minute.');
      const err = await provisionLoRaWAN(device.id);
      if (err) { setLwMsg('LoRaWAN setup failed: ' + err); setBusy(false); return; }
      setLwMsg('LoRaWAN keys sent. The node is switching over now.');
      setBusy(false);
      setTimeout(onClose, 1800);
      return;
    }
    // Switching a live LoRaWAN node back to Wi-Fi: the node is off the cloud's
    // direct reach, so we queue a downlink it applies on its next check-in.
    if (transport === 'wifi' && effectiveTransport(device) === 'lorawan' && !isDemoDevice(device)) {
      setLwMsg('Queuing the switch back to Wi-Fi… the node applies it on its next check-in (up to a few minutes).');
      const err = await switchToWiFi(device.id);
      if (err) { setLwMsg('Wi-Fi switch failed: ' + err); setBusy(false); return; }
      setLwMsg('Wi-Fi switch queued. The node will reconnect over Wi-Fi shortly.');
      setBusy(false);
      setTimeout(onClose, 1800);
      return;
    }
    setBusy(false);
    onClose();
  };
  // A claimed real device has a cloud id; demo devices don't get provisioned.
  function isDemoDevice(d) { return !d.losantDeviceId; }

  const destroy = async () => {
    if (confirm === 'reset') {
      setBusy(true);
      await factoryResetDevice(device.id); // sends the wipe command, then removes
      setBusy(false);
    } else {
      removeDevice(device.id);
    }
    onClose();
  };

  // Confirmation step with the data-loss disclaimer.
  if (confirm) {
    const reset = confirm === 'reset';
    return (
      <div className="overlay" onClick={onClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet__grab" />
          <h2>{reset ? 'Factory reset for a new owner?' : 'Remove this device?'}</h2>
          <div className="warnbox">
            <AlertTriangle size={18} color="var(--red)" />
            <div>
              {reset ? (
                <>This permanently deletes everything tied to <b>{device.name}</b> from your account: live history, journal photos, and alarms. If the unit is online, it also wipes its own Wi-Fi right now and reboots into setup mode, ready for the new owner to pair with the code on its screen. (If it's offline, they can hold the PRG button for 3 seconds instead.) If you ever reconnect this unit, you'll be starting from scratch.</>
              ) : (
                <><b>{device.name}</b> will be removed from your account, and its history, journal photos, and alarms are deleted. The unit itself keeps working, you can pair it again any time with the code on its screen.</>
              )}
            </div>
          </div>
          <button className="btn btn--danger" disabled={busy} onClick={destroy}>
            {busy ? 'Sending reset...' : reset ? 'Delete data & unpair' : 'Remove device'}
          </button>
          <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Edit device</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <DeviceAvatar device={{ ...device, photo }} size={64} radius={16} />
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="btn btn--ghost" style={{ width: 'auto', padding: '0 14px', cursor: 'pointer' }}>
                <Camera size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />{photo ? 'Change photo' : 'Add photo'}
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPickPhoto} />
              </label>
              {photo && (
                <button className="btn btn--ghost" style={{ width: 'auto', padding: '0 14px' }} onClick={() => setPhoto(null)}>Remove</button>
              )}
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '6px 2px 0' }}>A photo of the plant or spot this node watches.</p>
          </div>
        </div>

        <div className="fieldlabel">Plant name</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Device name" />

        <div className="fieldlabel">Plant's home location (city or ZIP)</div>
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Miami or 33199" />
        <p className="muted" style={{ fontSize: 12, margin: '-6px 2px 10px' }}>
          Weather and rain alerts use the plant's home, not your phone's location.
        </p>

        <div className="fieldlabel">Group (optional)</div>
        <input className="input" list="gp-groups" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Greenhouse, Backyard" />
        <datalist id="gp-groups">
          {groupSuggestions.map((g) => <option key={g} value={g} />)}
        </datalist>

        <div className="fieldlabel">Connection</div>
        <div className="choices">
          {Object.entries(TRANSPORTS).map(([key, t]) => (
            <div key={key} className={`choice ${transport === key ? 'active' : ''}`} onClick={() => setTransport(key)}>
              <TransportIcon name={t.icon} size={20} color={t.color} />
              {t.label}
            </div>
          ))}
        </div>
        {transport === 'lorawan' && (
          <p className="muted" style={{ fontSize: 12, margin: '-4px 2px 10px' }}>
            Saving sets this node up for LoRaWAN automatically: it gets its own keys and switches over the air
            (the node must be online and on v4+ firmware). It then joins through any gateway in range, no Wi-Fi
            needed, and reports every few minutes to save battery.
          </p>
        )}
        {transport === 'wifi' && transport !== device.transport && (
          <p className="muted" style={{ fontSize: 12, margin: '-4px 2px 10px' }}>
            Takes effect the next time the node powers on. Wi-Fi runs the usual phone setup and updates every few seconds.
          </p>
        )}
        <button className="btn btn--green" disabled={busy} onClick={save}>
          {busy ? (transport === 'lorawan' && device.transport !== 'lorawan' ? 'Setting up LoRaWAN…' : 'Saving...') : 'Save changes'}
        </button>
        {lwMsg && <p className="muted" style={{ fontSize: 12, margin: '8px 2px 0' }}>{lwMsg}</p>}

        <div className="danger">
          <div className="fieldlabel" style={{ color: 'var(--red)' }}>Danger zone</div>
          <button className="btn btn--ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirm('remove')}>
            <Trash2 size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />Remove from my account
          </button>
          <button className="btn btn--ghost" style={{ marginTop: 8, color: 'var(--red)' }} onClick={() => setConfirm('reset')}>
            <RefreshCcw size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />Factory reset · selling or gifting
          </button>
        </div>
      </div>
    </div>
    {cropSrc && (
      <ImageCropper
        src={cropSrc}
        onCancel={() => setCropSrc(null)}
        onDone={(cropped) => { setPhoto(cropped); setCropSrc(null); }}
      />
    )}
    </>
  );
}
