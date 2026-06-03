import { useState, useMemo } from 'react';
import { METRIC_ORDER, METRICS, buildSeries, rangesForDevice, displayValue, displayUnit } from '../store/helpers';
import { Pills } from '../components/UI';
import Chart from '../components/Chart';
import { useApp } from '../store/AppContext';

const RANGES = ['HOUR', 'DAY', 'WEEK', 'MONTH'];

export default function HistoryView() {
  const { selectedDevice, settings } = useApp();
  const [range, setRange] = useState('HOUR');
  const u = settings.units;
  const ranges = rangesForDevice(selectedDevice);

  // History centered on the selected plant's ideal band (demo data; real
  // long-term history comes from the backend). Regenerated per range/device/plant.
  const series = useMemo(() => {
    const out = {};
    for (const k of METRIC_ORDER) out[k] = buildSeries(k, range, ranges[k].good);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, selectedDevice.id, selectedDevice.plant]);

  return (
    <div>
      <div style={{ margin: '8px 0 14px' }}>
        <Pills options={RANGES} value={range} onChange={setRange} />
      </div>

      <div className="cardgrid">
        {METRIC_ORDER.map((k) => {
          const m = METRICS[k];
          const pts = series[k].points.map((p) => ({ t: p.t, value: displayValue(k, p.value, u) }));
          const vals = pts.map((p) => p.value);
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
          const unit = displayUnit(m.unit, u);
          const band = [displayValue(k, ranges[k].good[0], u), displayValue(k, ranges[k].good[1], u)];
          return (
            <div className="card" key={k}>
              <div className="chart__head"><div className="chart__title">{m.label}</div></div>
              <div className="chart__stats">
                <span>Max <b>{max}{unit}</b></span>
                <span>Avg <b>{avg}{unit}</b></span>
                <span>Min <b>{min}{unit}</b></span>
                <span style={{ color: '#2ecc71' }}>Ideal {band[0]}–{band[1]}{unit}</span>
              </div>
              <Chart series={{ points: pts, min, max, avg }} color={m.color} band={band} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
