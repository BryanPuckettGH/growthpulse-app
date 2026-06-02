// A single stat card: an icon, a label, and the current value with its unit.
// We reuse this one component for all five sensor readings.
export default function MetricCard({ label, icon, value, unit, accent }) {
  return (
    <div className="card">
      <div className="card__accent" style={{ background: accent }} />
      <p className="card__label">
        <span className="card__icon">{icon}</span>
        {label}
      </p>
      <div className="card__value">
        {value}
        {unit && <span className="card__unit">{unit}</span>}
      </div>
    </div>
  );
}
