// The top bar: logo, app name, and a live status pill showing the last update time.
export default function Header({ lastUpdated }) {
  const time = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--';

  return (
    <header className="header">
      <div className="header__title">
        <div className="header__logo">🌱</div>
        <div>
          <h1>GrowthPulse</h1>
          <p className="header__sub">Live environmental sensor node</p>
        </div>
      </div>

      <div className="status">
        <span className="status__dot" />
        Live · updated {time}
      </div>
    </header>
  );
}
