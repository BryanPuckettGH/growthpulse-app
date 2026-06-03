import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { TRANSPORTS } from '../store/helpers';
import { TransportIcon } from '../components/UI';
import { geocodePlace } from '../utils/geocode';
import { Plus, Sprout, Lock, Pencil, Trash2, RefreshCcw, AlertTriangle, MapPin } from 'lucide-react';
import AddDeviceSheet from '../components/AddDeviceSheet';
import ClaimDeviceSheet from '../components/ClaimDeviceSheet';

// List of all devices (tap to select) plus add/claim and full device
// management: rename, home location, delete, and factory reset for resale.
export default function DevicesView() {
  const { devices, selectedDeviceId, setSelectedDeviceId, addDevice, claimDevice, tier, openPlans, isDemo } = useApp();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const atLimit = devices.length >= tier.deviceLimit;

  return (
    <div>
      <div className="section-title">Your devices ({devices.length}{tier.deviceLimit < 99 ? ` of ${tier.deviceLimit}` : ''})</div>

      <div className="cardgrid">
      {devices.map((d) => {
        const t = TRANSPORTS[d.transport];
        return (
          <div key={d.id} className={`device ${d.id === selectedDeviceId ? 'selected' : ''}`} onClick={() => setSelectedDeviceId(d.id)}>
            <div className="device__avatar" style={{ background: t.color + '1a' }}><Sprout size={22} color={t.color} /></div>
            <div className="device__main">
              <div className="device__name">{d.name}</div>
              <div className="device__meta">
                <span className="badge"><TransportIcon name={t.icon} color={t.color} />{t.label}</span>
                <span><span className="dot" style={{ background: d.online ? '#2ecc71' : '#cfd3d8', marginRight: 5 }} />{d.online ? 'Online' : 'Offline'}</span>
                {d.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={11} />{d.location}</span>}
              </div>
            </div>
            <div className="device__reading">
              <div className="device__big">{d.hasData ? `${d.reading.soilMoisturePercent}%` : '—'}</div>
              <div className="device__small">{d.hasData ? 'moisture' : 'connecting'}</div>
            </div>
            <button className="device__edit" onClick={(e) => { e.stopPropagation(); setEditId(d.id); }} aria-label="Edit device"><Pencil size={16} /></button>
          </div>
        );
      })}
      </div>

      {atLimit ? (
        <button className="btn btn--ghost" style={{ marginTop: 6 }} onClick={openPlans}>
          <Lock size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Device limit reached, upgrade for more
        </button>
      ) : (
        <button className="btn btn--green" style={{ marginTop: 6 }} onClick={() => setOpen(true)}>
          <Plus size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Add device
        </button>
      )}

      {open && (isDemo
        ? <AddDeviceSheet onClose={() => setOpen(false)} onAdd={addDevice} />
        : <ClaimDeviceSheet onClose={() => setOpen(false)} onClaim={claimDevice} />)}
      {editId && devices.find((d) => d.id === editId) && (
        <DeviceEditSheet device={devices.find((d) => d.id === editId)} onClose={() => setEditId(null)} />
      )}
    </div>
  );
}

function DeviceEditSheet({ device, onClose }) {
  const { updateDevice, removeDevice } = useApp();
  const [name, setName] = useState(device.name);
  const [location, setLocation] = useState(device.location);
  const [transport, setTransport] = useState(device.transport);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // null | 'remove' | 'reset'

  const save = async () => {
    setBusy(true);
    let patch = { name: name.trim() || device.name, transport };
    const loc = location.trim();
    if (loc && loc !== device.location) {
      // Re-pin the plant's home: geocode the new place for weather.
      const geo = await geocodePlace(loc);
      patch = geo ? { ...patch, location: geo.label, geo } : { ...patch, location: loc };
    } else if (!loc) {
      patch = { ...patch, location: '', geo: undefined };
    }
    updateDevice(device.id, patch);
    setBusy(false);
    onClose();
  };

  const destroy = () => { removeDevice(device.id); onClose(); };

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
                <>This permanently deletes everything tied to <b>{device.name}</b> from your account: live history, journal photos, and alarms. The new owner sets it up fresh, they hold the PRG button for 3 seconds to clear your Wi-Fi, then pair it to their own account with the code on its screen. If you ever reconnect this unit, you'll be starting from scratch.</>
              ) : (
                <><b>{device.name}</b> will be removed from your account, and its history, journal photos, and alarms are deleted. The unit itself keeps working, you can pair it again any time with the code on its screen.</>
              )}
            </div>
          </div>
          <button className="btn btn--danger" onClick={destroy}>{reset ? 'Delete data & unpair' : 'Remove device'}</button>
          <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Edit device</h2>

        <div className="fieldlabel">Plant name</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Device name" />

        <div className="fieldlabel">Plant's home location (city or ZIP)</div>
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Miami or 33199" />
        <p className="muted" style={{ fontSize: 12, margin: '-6px 2px 10px' }}>
          Weather and rain alerts use the plant's home, not your phone's location.
        </p>

        <div className="fieldlabel">Connection</div>
        <div className="choices">
          {Object.entries(TRANSPORTS).map(([key, t]) => (
            <div key={key} className={`choice ${transport === key ? 'active' : ''}`} onClick={() => setTransport(key)}>
              <TransportIcon name={t.icon} size={20} color={t.color} />
              {t.label}
            </div>
          ))}
        </div>
        <button className="btn btn--green" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save changes'}</button>

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
  );
}
