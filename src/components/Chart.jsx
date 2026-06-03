import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
} from 'recharts';

// A history chart with a soft gradient fill plus the Max and Avg
// reference lines, matching the grow-app style.
export default function Chart({ series, color, band }) {
  const { points, max, avg } = series;
  const gid = 'grad-' + color.replace('#', '');

  return (
    <ResponsiveContainer width="100%" height={170}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="#2ecc71" fillOpacity={0.08} stroke="none" />}
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'var(--ink-3)' }} interval="preserveStartEnd" minTickGap={40} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--ink-3)' }} width={34} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
        <Tooltip contentStyle={{ borderRadius: 12, background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)', fontSize: 12, boxShadow: '0 8px 24px rgba(16,24,40,0.1)' }} />
        <ReferenceLine y={max} stroke="#cfd3d8" strokeDasharray="4 4" />
        <ReferenceLine y={avg} stroke={color} strokeDasharray="5 5" strokeOpacity={0.55} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.4} fill={`url(#${gid})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
