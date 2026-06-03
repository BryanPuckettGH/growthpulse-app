import { useState } from 'react';
import { useApp } from '../store/AppContext';
import AddDeviceSheet from './AddDeviceSheet';
import { LogOut } from 'lucide-react';

// Shown when an account has no devices yet. Prompts the user to connect their
// first GrowthPulse instead of showing demo data.
export default function Onboarding() {
  const { addDevice, logout } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <div className="onboard">
        <img className="onboard__icon" src="/growthpulse-icon.svg" alt="" />
        <h2 className="onboard__title">Welcome to GrowthPulse</h2>
        <p className="muted">
          Power on your GrowthPulse and connect it to your Wi-Fi, and it shows up here automatically.
          Or add one manually to get started.
        </p>
        <button className="btn btn--green" style={{ marginTop: 18 }} onClick={() => setOpen(true)}>Add a device</button>
        <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={logout}>
          <LogOut size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Log out
        </button>
      </div>
      {open && <AddDeviceSheet onClose={() => setOpen(false)} onAdd={addDevice} />}
    </div>
  );
}
