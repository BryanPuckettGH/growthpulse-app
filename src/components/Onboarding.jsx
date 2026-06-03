import { useState } from 'react';
import { useApp } from '../store/AppContext';
import ClaimDeviceSheet from './ClaimDeviceSheet';
import { LogOut } from 'lucide-react';

// Shown when an account has no devices yet. Prompts the user to connect their
// first GrowthPulse instead of showing demo data.
export default function Onboarding() {
  const { claimDevice, logout } = useApp();
  const [open, setOpen] = useState(false);

  return (
    // Uses the login wrapper (full-viewport, centered) rather than the app
    // shell: on desktop the shell becomes a sidebar grid and would squeeze
    // this screen into the 240px sidebar column.
    <div className="login">
      <div className="onboard">
        <img className="onboard__icon" src="/growthpulse-icon.svg" alt="" />
        <h2 className="onboard__title">Welcome to GrowthPulse</h2>
        <p className="muted">
          Power on your GrowthPulse and connect it to your Wi-Fi, then enter its pairing code here to
          bring your plant online.
        </p>
        <button className="btn btn--green" style={{ marginTop: 18 }} onClick={() => setOpen(true)}>Connect a device</button>
        <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={logout}>
          <LogOut size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Log out
        </button>
      </div>
      {open && <ClaimDeviceSheet onClose={() => setOpen(false)} onClaim={claimDevice} />}
    </div>
  );
}
