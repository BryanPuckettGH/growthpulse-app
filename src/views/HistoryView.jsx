import { useState, useMemo } from 'react';
import { METRIC_ORDER, METRICS, buildSeries } from '../store/helpers';
import { Pills } from '../components/UI';
import Chart from '../components/Chart';
import { useApp } from '../store/AppContext';

const RANGES = ['HOUR', 'DAY', 'WEEK', 'MONTH'];

export default function HistoryView() {
  const { selectedDevice } = useApp();
  const [range, setRange] = useState('HOUR');

  // Rebuild the chart series whenever the range or device changes.
  const series = useMemo(() => {
    const out = {};
    for (const k of METRIC_ORDER) out[k] = buildSeries(k, range);
    return out;
  }, [range, selectedDevice.id]);

  return (
    <div>
      <div style={{ margin: '8px 0 14px' }}>
        <Pills options={RANGES} value={range} onChange={setRange} />
      </div>

      <div className="cardgrid">
      {METRIC_ORDER.map((k) => {
        const m = METRICS[k];
        const s = series[k];
        return (
          <div className="card" key={k}>
            <div className="chart__head"><div className="chart__title">{m.label}</div></div>
            <div className="chart__stats">
              <span>Max <b>{s.max}{m.unit}</b></span>
              <span>Avg <b>{s.avg}{m.unit}</b></span>
              <span>Min <b>{s.min}{m.unit}</b></span>
            </div>
            <Chart series={s} color={m.color} />
          </div>
        );
      })}
      </div>
    </div>
  );
}
