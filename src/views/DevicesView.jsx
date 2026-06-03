import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { TRANSPORTS } from '../store/helpers';
import { TransportIcon } from '../components/UI';
import { Plus, Sprout, Lock, Pencil, Trash2 } from 'lucide-react';
import AddDeviceSheet from '../components/AddDeviceSheet';

// List of all devices (tap to select) plus an add-device sheet that lets
// you pick the connection type: Wi-Fi, LoRaWAN, or Ethernet.
export default function DevicesView() {
  const { devices, selectedDeviceId, setSelectedDeviceId, addDevice, tier, openPlans } = useApp();
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
              </div>
            </div>
            <div className="device__reading">
              <div className="device__big">{d.reading.soilMoisturePercent}%</div>
              <div className="device__small">moisture</div>
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

      {open && <AddDeviceSheet onClose={() => setOpen(false)} onAdd={addDevice} />}
      {editId && devices.find((d) => d.id === editId) && (
        <DeviceEditSheet device={devices.find((d) => d.id === editId)} onClose={() => setEditId(null)} />
      )}
    </div>
  );
}

function DeviceEditSheet({ device, onClose }) {
  const { updateDevice, removeDevice, devices } = useApp();
  const [name, setName] = useState(device.name);
  const [location, setLocation] = useState(device.location);
  const [transport, setTransport] = useState(device.transport);

  const save = () => { updateDevice(device.id, { name: name || device.name, location, transport }); onClose(); };
  const del = () => { removeDevice(device.id); onClose(); };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Edit device</h2>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Device name" />
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
        <div className="muted" style={{ margin: '4px 0 8px' }}>Connection</div>
        <div className="choices">
          {Object.entries(TRANSPORTS).map(([key, t]) => (
            <div key={key} className={`choice ${transport === key ? 'active' : ''}`} onClick={() => setTransport(key)}>
              <TransportIcon name={t.icon} size={20} color={t.color} />
              {t.label}
            </div>
          ))}
        </div>
        <button className="btn btn--green" onClick={save}>Save changes</button>
        {devices.length > 1 && (
          <button className="btn btn--ghost" style={{ marginTop: 10, color: '#ef4444' }} onClick={del}>
            <Trash2 size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />Delete device
          </button>
        )}
      </div>
    </div>
  );
}

