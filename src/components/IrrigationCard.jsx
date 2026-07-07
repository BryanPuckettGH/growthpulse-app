import { useApp } from '../store/AppContext';
import { Pills, Slider, Stepper, Toggle } from './UI';
import SetLocationInline from './SetLocationInline';
import { Droplet, CloudRain, MapPin } from 'lucide-react';

// Watering control, modeled on a grow-controller's Control tab. Drives the
// relay + pump from the irrigation kit. Demo runs a simulated pump; real
// control sends a device command through Losant at the backend phase.
export default function IrrigationCard() {
  const { selectedDevice, setIrrigation, runPump } = useApp();
  const irr = selectedDevice.irrigation || { mode: 'manual', targetMoisture: 35, durationSec: 5, enabled: false };
  const running = selectedDevice.pumpRunning;
  const reading = selectedDevice.reading;
  const moisture = reading.soilMoisturePercent;
  const paused = irr.pausedUntil && irr.pausedUntil > Date.now();
  const hasLocation = !!selectedDevice.geo;
  const rainDelayOn = !!irr.rainDelay && hasLocation;

  const set = (patch) => setIrrigation(selectedDevice.id, patch);

  // Rain delay needs the local forecast, which needs the plant's location.
  // Turning it on without a location is blocked and explained, not silently
  // ignored — so customers know exactly why location matters here.
  const toggleRainDelay = (v) => {
    if (v && !hasLocation) return; // gate handles the explanation below
    set({ rainDelay: v });
  };

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
            <p className="muted" style={{ marginTop: 8 }}>
              Waters automatically when soil drops below {irr.targetMoisture}%.
              {rainDelayOn ? ' Skips watering when rain is in the forecast.' : ''}
            </p>
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

        {/* Live confirmation from the flow sensor: water is actually moving
            (or pointedly isn't) while a run is active. */}
        {running && reading.flowLpm != null && (
          <p className="muted" style={{ margin: '10px 2px 0', fontWeight: 600, color: reading.flowLpm > 0 ? 'var(--green-d, #1a9b5a)' : '#f4a52b' }}>
            {reading.flowLpm > 0 ? `Flowing ${reading.flowLpm.toFixed(1)} L/min` : 'Waiting for water to move...'}
          </p>
        )}
        {!running && reading.flowFault && (
          <p className="muted" style={{ margin: '10px 2px 0', fontWeight: 600, color: '#ef4444' }}>
            Last run saw no water — valve was closed for safety. Check the supply.
          </p>
        )}
      </div>

      {/* Rain delay: skip watering when rain is forecast. Needs the plant's
          location, so this is where we ask for it and explain why. */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="field__row">
          <div style={{ paddingRight: 12 }}>
            <div className="field__label"><CloudRain size={15} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--blue)' }} />Rain delay</div>
            <div className="muted">Skip automatic watering when rain is in the local forecast, so you never overwater before a storm.</div>
          </div>
          <Toggle checked={rainDelayOn} onChange={toggleRainDelay} disabled={!hasLocation} />
        </div>

        {!hasLocation && (
          <div className="warnbox" style={{ marginTop: 14, marginBottom: 0 }}>
            <MapPin size={18} color="var(--blue)" />
            <div style={{ width: '100%' }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Add a location to use rain delay</div>
              <p className="muted" style={{ margin: '0 0 10px' }}>
                <b>{selectedDevice.name}</b> doesn't have a location yet. Rain delay checks the forecast where this
                plant lives, so it needs the plant's home location (a city or ZIP, not your phone's GPS) to work.
              </p>
              <SetLocationInline device={selectedDevice} cta="Save & enable" onDone={() => set({ rainDelay: true })} />
            </div>
          </div>
        )}
        {hasLocation && (
          <p className="muted" style={{ fontSize: 12, margin: '10px 2px 0' }}>
            <MapPin size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Using {selectedDevice.location || 'this plant’s location'} for the forecast.
          </p>
        )}
      </div>
    </>
  );
}
