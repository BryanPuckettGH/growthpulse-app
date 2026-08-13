import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { TIERS, TIER_ORDER } from '../store/tiers';
import Login from './Login';
import WelcomeModal, { GITHUB_URL } from './WelcomeModal';
import ProjectPage from './ProjectPage';
import {
  Activity, Sprout, CloudRain, Bell, Camera, RadioTower, Check,
  Wifi, Smartphone, KeyRound, BatteryFull, MapPin, FileText,
  Droplets, Droplet, Timer, ShieldCheck, DollarSign, Mic, AlertTriangle,
} from 'lucide-react';

/* The public site at growthpulsecloud.com. Logged-out visitors get a real
   marketing site with sub-pages; the app lives behind Sign in / Get started. */

const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'watering', label: 'Watering' },
  { id: 'farmkit', label: 'Farm Kit' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
  { id: 'project', label: 'The Project' },
];

export default function Landing() {
  const { startDemo } = useAuth();
  const [auth, setAuth] = useState(null);   // null | 'login' | 'signup'
  const [page, setPage] = useState('home');
  // The welcome overlay opens on every load of the public site, deliberately.
  // This is the introduction to the project, so a reload or a return visit
  // should show it again; only in-page navigation leaves it closed.
  const [welcome, setWelcome] = useState(true);

  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  const closeWelcome = () => setWelcome(false);

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
      {page === 'watering' && <WateringPage signup={signup} />}
      {page === 'farmkit' && <FarmKitPage signup={signup} />}
      {page === 'pricing' && <PricingPage signup={signup} />}
      {page === 'faq' && <FaqPage signup={signup} />}
      {page === 'project' && <ProjectPage demo={startDemo} />}

      <footer className="landing__footer">
        <div className="landing__footcols">
          <div>
            <b>Growth<span style={{ color: '#2ecc71', fontWeight: 400 }}>Pulse</span></b>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Smart plant monitoring that knows what your plants need, and waters them for you.</p>
          </div>
          <div>
            <div className="landing__foothead">Product</div>
            <button className="landing__footlink" onClick={() => go('features')}>Features</button>
            <button className="landing__footlink" onClick={() => go('watering')}>Watering</button>
            <button className="landing__footlink" onClick={() => go('farmkit')}>Farm Kit</button>
            <button className="landing__footlink" onClick={() => go('pricing')}>Pricing</button>
          </div>
          <div>
            <div className="landing__foothead">Support</div>
            <button className="landing__footlink" onClick={() => go('faq')}>FAQ</button>
            <button className="landing__footlink" onClick={startDemo}>Live demo</button>
            <button className="landing__footlink" onClick={() => setAuth('login')}>Sign in</button>
          </div>
          <div>
            <div className="landing__foothead">The Project</div>
            <button className="landing__footlink" onClick={() => go('project')}>How it was built</button>
            <button className="landing__footlink" onClick={() => setWelcome(true)}>Message from the team lead</button>
            <a className="landing__footlink" href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
        <div className="landing__footbase muted">FIU Senior Design · {new Date().getFullYear()} · growthpulsecloud.com</div>
      </footer>

      {welcome && (
        <WelcomeModal
          onClose={closeWelcome}
          onSeeProject={() => { closeWelcome(); go('project'); }}
        />
      )}
    </div>
  );
}

function CtaBanner({ signup, title = 'Ready to meet your happiest plants?' }) {
  return (
    <div className="landing__cta-banner">
      <h3>{title}</h3>
      <p>Set up in five minutes. No credit card, no commitment.</p>
      <button className="lbtn lbtn--white" onClick={signup}>Get started free</button>
    </div>
  );
}

function HomePage({ signup, demo, go }) {
  return (
    <>
      <header className="landing__hero">
        <div className="landing__herotext">
          <span className="landing__badge">NEW · Automatic watering, metered to the gallon</span>
          <h1>Know what your plants need. Then let it do the watering.</h1>
          <p>
            GrowthPulse watches soil moisture, soil temperature, air temperature, and humidity around
            the clock, then acts on it: it opens the valve, confirms water is actually moving, meters
            every gallon, and shuts itself off if something goes wrong. Plug it in, pair it from your
            phone, done.
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
          <div className="landing__mockwater">
            <Droplet size={15} color="#13a4ff" />
            <span>Watered 4 min ago · 1.9 L/min confirmed</span>
            <b>2.4 gal today</b>
          </div>
        </div>
      </header>

      <div className="landing__stats">
        <div><b>5</b><span>sensors per node</span></div>
        <div><b>Auto</b><span>watering with dry-run cutoff</span></div>
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
          <div className="landing__feature"><Activity size={20} color="#2ecc71" /><b>Live health score</b><p>Every sensor blends into one 0-100 score, tuned to your exact plant.</p></div>
          <div className="landing__feature"><Droplets size={20} color="#13a4ff" /><b>Waters it for you</b><p>Timed runs from the app or your voice, with live flow confirmation while the water moves.</p></div>
          <div className="landing__feature"><CloudRain size={20} color="#a06bff" /><b>Weather-aware</b><p>A virtual rain gauge at your plant's home skips a watering before rain.</p></div>
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
    { icon: <Droplets size={22} color="#13a4ff" />, t: 'Automatic watering', d: 'Open the valve on a timed run from the app, and watch live flow confirmation while it runs: "Flowing 1.9 L/min" instead of a hopeful spinner. Runs close themselves when the time is up.' },
    { icon: <DollarSign size={22} color="#1a9b5a" />, t: 'Water used, and what it cost', d: 'A flow meter counts every gallon. See usage today, this week, and this month with real dollar costs from your own utility rate, plus this run\'s volume and the lifetime total. Toggle gallons or liters and the rate converts with it.' },
    { icon: <ShieldCheck size={22} color="#ef4444" />, t: 'Dry-run and leak protection', d: 'If the valve opens and no water moves, an empty reservoir or a dead pump, the node closes the valve itself without waiting for the cloud. If water flows for 30 seconds while the valve is shut, a leak alarm trips.' },
    { icon: <Mic size={22} color="#a06bff" />, t: 'Works with Google Home', d: 'Ask for a reading or start a watering run by voice. "Hey Google, run the garden for ten seconds" opens the valve for exactly that long.' },
    { icon: <Smartphone size={22} color="#2c3e50" />, t: 'Native iPhone app', d: 'A full native iOS app on the same account and the same live data as the web app, including the QR pairing scanner.' },
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

function WateringPage({ signup }) {
  const W = [
    { icon: <Timer size={22} color="#13a4ff" />, t: 'Timed runs, from anywhere', d: 'Start a run from the app or by voice and give it a duration. The valve closes itself when the time is up, and a hard maximum-open watchdog closes it even if nothing else does.' },
    { icon: <Droplet size={22} color="#13a4ff" />, t: 'Live flow confirmation', d: 'While a run is going the card shows real litres per minute straight off the meter, so "watering" always means water actually moved.' },
    { icon: <ShieldCheck size={22} color="#2ecc71" />, t: 'It protects itself', d: 'Valve open and no flow means an empty reservoir, a kinked line, or a dead pump. The node shuts the valve on its own rather than waiting for the cloud to notice.' },
    { icon: <AlertTriangle size={22} color="#ef4444" />, t: 'Leak alarm', d: 'Water moving for 30 seconds or more with the valve closed trips a leak alarm. Both fault alarms are on by default and explain the condition instead of showing a threshold slider.' },
    { icon: <DollarSign size={22} color="#1a9b5a" />, t: 'Metered like a utility', d: 'Usage per day is computed by diffing the meter\'s cumulative counter, so it stays accurate through missed readings and counter resets. Set your rate per 1,000 gallons and see the cost.' },
    { icon: <CloudRain size={22} color="#a06bff" />, t: 'Rain delay', d: 'The forecast at the plant\'s own location can hold a watering back when rain is coming, so you are not paying to water the yard an hour before a storm.' },
  ];
  return (
    <>
      <header className="landing__pagehead">
        <h1>Watering that closes the loop</h1>
        <p>
          Monitoring tells you the soil is dry. GrowthPulse does something about it, then proves it
          worked and tells you what it cost.
        </p>
      </header>
      <section className="landing__section" style={{ paddingTop: 0 }}>
        <div className="landing__steps">
          <div className="landing__step"><div className="landing__stepicon"><Droplets size={22} /></div><b>1. It opens the valve</b><p>On a schedule you set, on demand from the app, or by voice.</p></div>
          <div className="landing__step"><div className="landing__stepicon"><Droplet size={22} /></div><b>2. It confirms the water</b><p>A flow meter in the line reports live litres per minute during the run.</p></div>
          <div className="landing__step"><div className="landing__stepicon"><DollarSign size={22} /></div><b>3. It counts the cost</b><p>Every gallon is metered and priced against your utility rate.</p></div>
        </div>
      </section>
      <div className="landing__features landing__features--page">
        {W.map((f, i) => (
          <div className="landing__feature" key={i}>{f.icon}<b>{f.t}</b><p>{f.d}</p></div>
        ))}
      </div>
      <div className="landing__farmnote card">
        <b>What's in the line</b>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          A solenoid valve and a YF-S201 flow meter sit between your water source and the plant. The
          node drives the valve and counts the meter's pulses, so the watering, the confirmation, and
          the accounting all come from the same board that reads the soil.
        </p>
      </div>
      <CtaBanner signup={signup} title="Stop guessing whether it actually watered." />
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
    ['Can it actually water the plant, or does it just tell me to?', 'It waters. A solenoid valve in the line opens on a timed run you start from the app or by voice, and closes itself when the run is done.'],
    ['How does it know how much water it used?', 'A flow meter counts pulses as water passes. Daily usage comes from the difference in its cumulative counter, the same way a utility meter works, so a missed reading or a counter reset does not throw the total off.'],
    ['What happens if the pump runs dry or a line springs a leak?', 'If the valve opens and no water moves, the node closes it on its own without waiting for the cloud, and the app shows a no-flow warning. If water moves for 30 seconds while the valve is shut, a leak alarm trips. Both are on by default.'],
    ['Can I use my voice?', 'Yes, through Google Home. Ask for a reading, or say how long to run: "Hey Google, run the garden for ten seconds."'],
    ['Is there an iPhone app?', 'Yes, a native iOS app on the same account and the same live data as the web app. The web app also installs to your home screen if you would rather not go through the App Store.'],
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
