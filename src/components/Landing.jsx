import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { TIERS, TIER_ORDER } from '../store/tiers';
import Login from './Login';
import { Activity, Sprout, CloudRain, Bell, Camera, RadioTower, Check, Wifi, Smartphone, KeyRound } from 'lucide-react';

// The public marketing page at growthpulsecloud.com. Logged-out visitors land
// here; the app lives behind Sign in / Get started. Demo opens instantly.
export default function Landing() {
  const { startDemo } = useAuth();
  const [auth, setAuth] = useState(null); // null | 'login' | 'signup'

  if (auth) return <Login initialMode={auth} onBack={() => setAuth(null)} />;

  return (
    <div className="landing">
      <nav className="landing__nav">
        <span className="landing__navbrand">
          <img src="/growthpulse-icon.svg" alt="" />
          <b>Growth<span>Pulse</span></b>
        </span>
        <span className="landing__navlinks">
          <button className="btn btn--ghost landing__navbtn" onClick={() => setAuth('login')}>Sign in</button>
          <button className="btn btn--green landing__navbtn" onClick={() => setAuth('signup')}>Get started</button>
        </span>
      </nav>

      <header className="landing__hero">
        <div className="landing__herotext">
          <h1>Know exactly what your plants need.</h1>
          <p>
            GrowthPulse watches soil moisture, soil temperature, air temperature, and humidity around
            the clock, then tells you what to do about it. Plug it in, pair it from your phone, done.
          </p>
          <div className="landing__cta">
            <button className="btn btn--green" style={{ width: 'auto', padding: '0 26px' }} onClick={() => setAuth('signup')}>Get started free</button>
            <button className="btn btn--ghost" style={{ width: 'auto', padding: '0 26px' }} onClick={startDemo}>Explore the live demo</button>
          </div>
          <p className="landing__finely">No credit card. The demo opens instantly with sample plants.</p>
        </div>

        <div className="landing__mock card">
          <div className="landing__mockhead">
            <span className="dot" style={{ background: '#2ecc71' }} /> Kitchen Basil · Online
          </div>
          <div className="hero">
            <div className="hero__metric"><div className="hero__val" style={{ color: '#2ecc71' }}>76<span className="hero__unit">°F</span></div><div className="hero__label">Temperature</div></div>
            <div className="hero__metric" style={{ textAlign: 'center' }}><div className="hero__val" style={{ color: '#13a4ff' }}>54<span className="hero__unit">%</span></div><div className="hero__label">Humidity</div></div>
            <div className="hero__metric" style={{ textAlign: 'right' }}><div className="hero__val" style={{ color: '#2ecc71' }}>61<span className="hero__unit">%</span></div><div className="hero__label">Soil Moisture</div></div>
          </div>
          <div className="bar" style={{ marginTop: 14 }}><div className="bar__fill" style={{ width: '88%', background: '#2ecc71' }} /></div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>88 / 100 plant health · everything looks ideal</div>
        </div>
      </header>

      <section className="landing__section">
        <h2>Up and running in three steps</h2>
        <div className="landing__steps">
          <div className="landing__step"><div className="landing__stepicon"><Wifi size={22} /></div><b>1. Plug it in</b><p>Power the unit with any USB-C charger. It opens its own setup hotspot.</p></div>
          <div className="landing__step"><div className="landing__stepicon"><Smartphone size={22} /></div><b>2. Join from your phone</b><p>Pick your home Wi-Fi on the branded setup page. No app install required.</p></div>
          <div className="landing__step"><div className="landing__stepicon"><KeyRound size={22} /></div><b>3. Pair with the code</b><p>Type the code from the unit's screen into your account. Your plant is live.</p></div>
        </div>
      </section>

      <section className="landing__section">
        <h2>Everything a plant parent needs</h2>
        <div className="landing__features">
          <div className="landing__feature"><Activity size={20} color="#2ecc71" /><b>Live health score</b><p>Four sensors blend into one 0-100 score, tuned to your exact plant.</p></div>
          <div className="landing__feature"><Sprout size={20} color="#1a9b5a" /><b>Plant profiles</b><p>Pick your species and the ideal ranges, colors, and advice adjust automatically.</p></div>
          <div className="landing__feature"><CloudRain size={20} color="#13a4ff" /><b>Weather-aware</b><p>A virtual rain gauge at your plant's home suggests skipping a watering before rain.</p></div>
          <div className="landing__feature"><Bell size={20} color="#f4a52b" /><b>Real alerts</b><p>Email and SMS the moment soil gets too dry or heat spikes, even with the app closed.</p></div>
          <div className="landing__feature"><Camera size={20} color="#a06bff" /><b>Journal and reports</b><p>Photo growth timeline plus a shareable PDF report of your plant's data.</p></div>
          <div className="landing__feature"><RadioTower size={20} color="#a06bff" /><b>Goes the distance</b><p>The Farm Kit gateway puts nodes miles from your router, fields and far greenhouses included.</p></div>
        </div>
      </section>

      <section className="landing__section">
        <h2>Simple pricing</h2>
        <div className="landing__pricing">
          {TIER_ORDER.map((id) => {
            const t = TIERS[id];
            return (
              <div key={id} className="landing__plan" style={{ borderColor: id === 'plus' ? t.color : undefined }}>
                <div className="plan__name" style={{ color: t.color }}>{t.name}</div>
                <div className="landing__price">{t.price}<span>{t.period}</span></div>
                <div className="plan__tag">{t.tagline}</div>
                <div className="plan__perks" style={{ marginTop: 10 }}>
                  {t.perks.map((p, i) => <div className="plan__perk" key={i}><Check size={14} color={t.color} />{p}</div>)}
                </div>
                <button className="btn" style={{ background: t.color, color: '#fff', marginTop: 12 }} onClick={() => setAuth('signup')}>
                  {id === 'free' ? 'Start free' : `Get ${t.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="landing__section landing__faq">
        <h2>Questions, answered</h2>
        <details><summary>Do I need any technical skills to set it up?</summary><p>None. Plug it in, join its Wi-Fi from your phone, type the code on its screen. The whole setup takes about five minutes.</p></details>
        <details><summary>Does it work outdoors?</summary><p>The soil probes are made for soil and water. Keep the main unit sheltered from rain, or go LoRaWAN with the Farm Kit for far-flung spots.</p></details>
        <details><summary>What if I move or change my Wi-Fi?</summary><p>Hold the button on the unit for three seconds and it reopens setup. Your plant's history and settings stay untouched.</p></details>
        <details><summary>Can I try it without buying anything?</summary><p>Yes, the live demo opens instantly with sample plants and every feature unlocked. No account needed.</p></details>
      </section>

      <footer className="landing__footer">
        <span><b>Growth<span style={{ color: '#2ecc71', fontWeight: 400 }}>Pulse</span></b> · Smart Plant Monitoring</span>
        <span className="muted">FIU Senior Design · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
