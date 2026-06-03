import { useState } from 'react';
import { TRANSPORTS } from '../store/helpers';
import { TransportIcon } from './UI';

// Add a device. For now this creates the device record; once the real
// claim flow is wired, it binds a physical unit to the account.
export default function AddDeviceSheet({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [transport, setTransport] = useState('wifi');

  const submit = () => {
    onAdd(name || 'New Node', location || 'Unspecified', transport);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Add a device</h2>
        <input className="input" placeholder="Device name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <div className="muted" style={{ margin: '4px 0 8px' }}>How does it connect?</div>
        <div className="choices">
          {Object.entries(TRANSPORTS).map(([key, t]) => (
            <div key={key} className={`choice ${transport === key ? 'active' : ''}`} onClick={() => setTransport(key)}>
              <TransportIcon name={t.icon} size={20} color={t.color} />
              {t.label}
            </div>
          ))}
        </div>
        <button className="btn btn--green" onClick={submit}>Add device</button>
      </div>
    </div>
  );
}
