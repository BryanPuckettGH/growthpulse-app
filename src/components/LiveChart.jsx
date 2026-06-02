import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// A live line chart of the rolling history. Recharts does the heavy lifting;
// we just hand it the data and tell it which fields to draw.
export default function LiveChart({ history }) {
  // Reshape each reading into the flat object the chart expects.
  const data = history.map((r) => ({
    time: new Date(r.time).toLocaleTimeString([], {
      minute: '2-digit',
      second: '2-digit',
    }),
    'Soil Moisture %': r.soilMoisturePercent,
    'Air Temp °F': r.airTemperatureF,
    'Humidity %': r.airHumidity,
  }));

  return (
    <div className="panel">
      <h2 className="panel__title">
        Live readings <span>· last {history.length} samples</span>
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3441" />
          <XAxis dataKey="time" stroke="#8b97a6" fontSize={11} />
          <YAxis stroke="#8b97a6" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: '#161b22',
              border: '1px solid #2a3441',
              borderRadius: 8,
              color: '#e6edf3',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="Soil Moisture %" stroke="#3fb950" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="Air Temp °F" stroke="#58a6ff" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="Humidity %" stroke="#39c5cf" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
