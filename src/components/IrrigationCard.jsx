import { useApp } from '../store/AppContext';
import { Pills, Slider, Stepper, Toggle } from './UI';
import { Droplet, CloudRain } from 'lucide-react';

// Watering control, modeled on a grow-controller's Control tab. Drives the
// relay + pump from the irrigation kit. Demo runs a simulated pump; real
// control sends a device command through Losant at the backend phase.
export default function IrrigationCard() {
  const { selectedDevice, setIrrigation, runPump } = useApp();
  const irr = selectedDevice.irrigation || { mode: 'manual', targetMoisture: 35, durationSec: 5, enabled: false };
  const running = selectedDevice.pumpRunning;
  const moisture = selectedDevice.reading.soilMoisturePercent;
  const paused = irr.pausedUntil && irr.pausedUntil > Date.now();

  const set = (patch) => setIrrigation(selectedDevice.id, patch);

  return (
    <>
      <div className="section-title">Watering</div>
      <div className="card">
        {paused && (
          <div className="weather-note weather-note--rain" style={{ marginTop: 0, marginBottom: 14 }}>
            <CloudRain size={15} /> Watering paused until {new Date(irr.pausedUntil).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            <button onClick={() => set({ pausedUntil: null })} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer' }}>Resume</button>
          </div>
        )}
        <div className="field__row" style={{ marginBottom: 14 }}>
          <div>
            <div className="field__label">{running ? 'Watering now' : irr.enabled && irr.mode === 'auto' ? 'Auto running' : 'Manual'}</div>
            <div className="muted">soil at {moisture}%{irr.mode === 'auto' ? `, target ${irr.targetMoisture}%` : ''}</div>
          </div>
          <Toggle checked={irr.enabled} onChange={(v) => set({ enabled: v })} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <Pills
            options={[{ value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }, { value: 'schedule', label: 'Schedule' }]}
            value={irr.mode}
            onChange={(v) => set({ mode: v })}
            blue
          />
        </div>

        {irr.mode === 'auto' && (
          <>
            <div className="field__row"><span className="muted">Water below</span><span className="field__value">{irr.targetMoisture}%</span></div>
            <Slider min={5} max={80} value={irr.targetMoisture} onChange={(v) => set({ targetMoisture: v })} />
            <div className="ticks"><span>5%</span><span>80%</span></div>
            <p className="muted" style={{ marginTop: 8 }}>Waters automatically when soil drops below {irr.targetMoisture}%. Skips when rain is in the forecast.</p>
          </>
        )}

        {irr.mode === 'schedule' && (
          <p className="muted" style={{ margin: '2px 0 4px' }}>Waters on a daily schedule. The schedule editor arrives with the backend.</p>
        )}

        <div className="field__row" style={{ marginTop: 12 }}>
          <span className="field__label">Pump duration</span>
          <Stepper value={irr.durationSec} min={1} max={30} suffix="s" onChange={(v) => set({ durationSec: v })} />
        </div>

        <button className="btn btn--blue" style={{ marginTop: 14 }} disabled={running} onClick={() => runPump(selectedDevice.id, irr.durationSec)}>
          <Droplet size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />{running ? 'Watering...' : 'Water now'}
        </button>
      </div>
    </>
  );
}
