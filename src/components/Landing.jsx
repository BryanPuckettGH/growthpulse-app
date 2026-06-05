import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { TIERS, TIER_ORDER } from '../store/tiers';
import Login from './Login';
import {
  Activity, Sprout, CloudRain, Bell, Camera, RadioTower, Check,
  Wifi, Smartphone, KeyRound, BatteryFull, MapPin, FileText,
} from 'lucide-react';

/* The public site at growthpulsecloud.com. Logged-out visitors get a real
   marketing site with sub-pages; the app lives behind Sign in / Get started. */

const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'farmkit', label: 'Farm Kit' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

export default function Landing() {
  const { startDemo } = useAuth();
  const [auth, setAuth] = useState(null);   // null | 'login' | 'signup'
  const [page, setPage] = useState('home');

  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  if (auth) return <Login initialMode={auth} onBack={() => setAuth(null)} />;

  const go = (p) => setPage(p);
  const signup = () => setAuth('signup');

  return (
    <div className="landing">
      <nav className="landing__nav">
        <button className="landing__navbrand" onClick={() => go('home')}>
          <img src="/growthpulse-icon.svg" alt="" />
          <b>Growth<span>Pulse</span></b>
        </button>
        <span className="landing__navpages">
          {PAGES.map((p) => (
            <button key={p.id} className={`landing__navlink ${page === p.id ? 'active' : ''}`} onClick={() => go(p.id)}>
              {p.label}
            </button>
          ))}
        </span>
        <span className="landing__navlinks">
          <button className="lbtn lbtn--ghost lbtn--small" onClick={() => setAuth('login')}>Sign in</button>
          <button className="lbtn lbtn--primary lbtn--small" onClick={signup}>Get started</button>
        </span>
      </nav>

      {page === 'home' && <HomePage signup={signup} demo={startDemo} go={go} />}
      {page === 'features' && <FeaturesPage signup={signup} />}
      {page === 'farmkit' && <FarmKitPage signup={signup} />}
      {page === 'pricing' && <PricingPage signup={signup} />}
      {page === 'faq' && <FaqPage signup={signup} />}

      <footer className="landing__footer">
        <div className="landing__footcols">
          <div>
            <b>Growth<span style={{ color: '#2ecc71', fontWeight: 400 }}>Pulse</span></b>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Smart plant monitoring that tells you exactly what your plants need.</p>
          </div>
          <div>
            <div className="landing__foothead">Product</div>
            <button className="landing__footlink" onClick={() => go('features')}>Features</button>
            <button className="landing__footlink" onClick={() => go('farmkit')}>Farm Kit</button>
            <button className="landing__footlink" onClick={() => go('pricing')}>Pricing</button>
          </div>
          <div>
            <div className="landing__foothead">Support</div>
            <button className="landing__footlink" onClick={() => go('faq')}>FAQ</button>
            <button className="landing__footlink" onClick={startDemo}>Live demo</button>
            <button className="landing__footlink" onClick={() => setAuth('login')}>Sign in</button>
          </div>
        </div>
        <div className="landing__footbase muted">FIU Senior Design · {new Date().getFullYear()} · growthpulsecloud.com</div>
      </footer>
    </div>
  );
}

function CtaBanner({ signup, title = 'Ready to meet your happiest plants?' }) {
  return (
    <div className="landing__cta-banner">
      <h3>{title}</h3>
      <p>Set up in five minutes. No app store, no credit card.</p>
      <button className="lbtn lbtn--white" onClick={signup}>Get started free</button>
    </div>
  );
}

function HomePage({ signup, demo, go }) {
  return (
    <>
      <header className="landing__hero">
        <div className="landing__herotext">
          <span className="landing__badge">NEW · LoRaWAN Farm Kit for fields and far greenhouses</span>
          <h1>Know exactly what your plants need.</h1>
          <p>
            GrowthPulse watches soil moisture, soil temperature, air temperature, and humidity around
            the clock, then tells you what to do about it. Plug it in, pair it from your phone, done.
          </p>
          <div className="landing__ctarow">
            <button className="lbtn lbtn--primary" onClick={signup}>Get started free</button>
            <button className="lbtn lbtn--ghost" onClick={demo}>Explore the live demo</button>
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

      <div className="landing__stats">
        <div><b>4</b><span>sensors per node</span></div>
        <div><b>3s</b><span>live updates on Wi-Fi</span></div>
        <div><b>Miles</b><span>of range with the Farm Kit</span></div>
        <div><b>5 min</b><span>from box to dashboard</span></div>
      </div>

      <section className="landing__section">
        <h2>Up and running in three steps</h2>
        <div className="landing__steps">
          <div className="landing__step"><div className="landing__stepicon"><Wifi size={22} /></div><b>1. Plug it in</b><p>Power the unit with any USB-C charger. It opens its own setup hotspot.</p></div>
          <div className="landing__step"><div className="landing__stepicon"><Smartphone size={22} /></div><b>2. Join from your phone</b><p>Pick your home Wi-Fi on the branded setup page. No app install required.</p></div>
          <div className="landing__step"><div className="landing__stepicon"><KeyRound size={22} /></div><b>3. Pair with the code</b><p>Type the code from the unit's screen into your account. Your plant is live.</p></div>
        </div>
      </section>

      <section className="landing__section">
        <div className="landing__sectionhead">
          <h2>Everything a plant parent needs</h2>
          <button className="landing__more" onClick={() => go('features')}>See all features →</button>
        </div>
        <div className="landing__features">
          <div className="landing__feature"><Activity size={20} color="#2ecc71" /><b>Live health score</b><p>Four sensors blend into one 0-100 score, tuned to your exact plant.</p></div>
          <div className="landing__feature"><CloudRain size={20} color="#13a4ff" /><b>Weather-aware</b><p>A virtual rain gauge at your plant's home suggests skipping a watering before rain.</p></div>
          <div className="landing__feature"><Bell size={20} color="#f4a52b" /><b>Real alerts</b><p>Email and SMS the moment soil gets too dry, even with the app closed.</p></div>
        </div>
      </section>

      <CtaBanner signup={signup} />
    </>
  );
}

function FeaturesPage({ signup }) {
  const F = [
    { icon: <Activity size={22} color="#2ecc71" />, t: 'Live health score', d: 'Soil moisture, soil temperature, air temperature, and humidity blend into one 0-100 score. Colors tell you at a glance: green is ideal, amber is drifting, red needs you now. Disconnected probes say so honestly instead of faking numbers.' },
    { icon: <Sprout size={22} color="#1a9b5a" />, t: 'Plant profiles', d: 'Tell GrowthPulse what you grow, basil, tomatoes, ferns, succulents, and the ideal ranges, advice, and alarm suggestions retune automatically to that species.' },
    { icon: <CloudRain size={22} color="#13a4ff" />, t: 'Weather that follows the plant', d: 'Each plant stores its home location, so forecasts and rain alerts stay correct even when you travel. Rain coming? GrowthPulse suggests skipping the watering.' },
    { icon: <Bell size={22} color="#f4a52b" />, t: 'Alerts that reach you anywhere', d: 'Set thresholds per sensor or use one-tap suggestions from your plant profile. Trips notify in-app instantly and by email or SMS even when the app is closed.' },
    { icon: <Camera size={22} color="#a06bff" />, t: 'Growth journal and reports', d: 'Build a photo timeline of your plant, then share a polished PDF report of readings, stats, weather, and journal highlights with one tap.' },
    { icon: <BatteryFull size={22} color="#2ecc71" />, t: 'Power aware', d: 'Every device shows how it is powered. Battery units warn you at 20 percent and again before they would go offline, with advice to stretch battery life.' },
    { icon: <MapPin size={22} color="#13a4ff" />, t: 'Organize your garden', d: 'Group plants by greenhouse, room, or field. Rename, move, and manage every unit from one screen, including a factory reset that prepares a unit for resale.' },
    { icon: <FileText size={22} color="#8b97a6" />, t: 'Your data is yours', d: 'Accounts are private, devices belong to exactly one owner, and you can export everything you own as a file at any time.' },
  ];
  return (
    <>
      <header className="landing__pagehead">
        <h1>Features</h1>
        <p>Everything in GrowthPulse exists to answer one question: what does this plant need right now?</p>
      </header>
      <div className="landing__features landing__features--page">
        {F.map((f, i) => (
          <div className="landing__feature" key={i}>{f.icon}<b>{f.t}</b><p>{f.d}</p></div>
        ))}
      </div>
      <CtaBanner signup={signup} />
    </>
  );
}

function FarmKitPage({ signup }) {
  return (
    <>
      <header className="landing__pagehead">
        <h1>The Farm Kit</h1>
        <p>Wi-Fi is perfect indoors. Fields, orchards, and far greenhouses need range, that's LoRaWAN.</p>
      </header>
      <section className="landing__section" style={{ paddingTop: 0 }}>
        <div className="landing__steps">
          <div className="landing__step"><div className="landing__stepicon"><RadioTower size={22} /></div><b>One gateway</b><p>Plug the gateway into your router. It's the only piece that ever touches the internet.</p></div>
          <div className="landing__step"><div className="landing__stepicon"><Wifi size={22} /></div><b>Nodes join themselves</b><p>Power a node anywhere within miles of the gateway and it connects automatically. No Wi-Fi screens, no passwords.</p></div>
          <div className="landing__step"><div className="landing__stepicon"><BatteryFull size={22} /></div><b>Months on battery</b><p>LoRaWAN nodes report every few minutes instead of every few seconds, which is what makes batteries last a season.</p></div>
        </div>
        <div className="landing__farmnote card">
          <b>Buying more nodes later?</b>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Power them on near your gateway and pair with the code on their screen. The gateway part is already done.
            Same app, same dashboard, your whole field next to your kitchen basil.
          </p>
        </div>
      </section>
      <CtaBanner signup={signup} title="Put a sensor a mile from your router." />
    </>
  );
}

function PricingPage({ signup }) {
  return (
    <>
      <header className="landing__pagehead">
        <h1>Simple pricing</h1>
        <p>Start free with up to three plants. Upgrade when your garden does.</p>
      </header>
      <div className="landing__pricing">
        {TIER_ORDER.map((id) => {
          const t = TIERS[id];
          return (
            <div key={id} className={`landing__plan ${id === 'plus' ? 'landing__plan--hot' : ''}`}>
              {id === 'plus' && <div className="landing__planflag">Most popular</div>}
              <div className="plan__name" style={{ color: t.color }}>{t.name}</div>
              <div className="landing__price">{t.price}<span>{t.period}</span></div>
              <div className="plan__tag">{t.tagline}</div>
              <div className="plan__perks" style={{ marginTop: 10 }}>
                {t.perks.map((p, i) => <div className="plan__perk" key={i}><Check size={14} color={t.color} />{p}</div>)}
              </div>
              <button className="lbtn lbtn--primary" style={{ width: '100%', marginTop: 14, background: t.color }} onClick={signup}>
                {id === 'free' ? 'Start free' : `Get ${t.name}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="muted center" style={{ fontSize: 13, marginTop: 14 }}>Hardware sold separately. Every plan works with every GrowthPulse unit.</p>
      <CtaBanner signup={signup} />
    </>
  );
}

function FaqPage({ signup }) {
  const QA = [
    ['Do I need any technical skills to set it up?', 'None. Plug it in, join its Wi-Fi from your phone, type the code on its screen. The whole setup takes about five minutes.'],
    ['Does it work outdoors?', 'The soil probes are made for soil and water. Keep the main unit sheltered from rain, or go LoRaWAN with the Farm Kit for far-flung spots.'],
    ['What if I move or change my Wi-Fi?', 'Hold the button on the unit for three seconds and it reopens setup. Your plant history and settings stay untouched.'],
    ['Can I try it without buying anything?', 'Yes, the live demo opens instantly with sample plants and every feature unlocked. No account needed.'],
    ['Can I see my plants from any device?', 'Yes. Your plants belong to your account, not a browser. Sign in on your phone, laptop, or a friend\'s computer and everything is there.'],
    ['What happens if someone else tries my pairing code?', 'Nothing. A unit belongs to exactly one account at a time. It only becomes claimable again when you remove it or factory reset it.'],
    ['Can I sell or gift my unit?', 'Yes. Factory reset in the app erases your data, releases your claim, and remotely tells the unit to wipe its Wi-Fi so the new owner unboxes a fresh experience.'],
    ['Is my data private?', 'Each account sees only its own plants, enforced at the database level. You can export everything you own from Settings at any time.'],
  ];
  return (
    <>
      <header className="landing__pagehead">
        <h1>Questions, answered</h1>
        <p>The things people ask before their first GrowthPulse.</p>
      </header>
      <div className="landing__faq">
        {QA.map(([q, a], i) => (
          <details key={i}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </div>
      <CtaBanner signup={signup} />
    </>
  );
}
