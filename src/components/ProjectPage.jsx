import { TEAM, GITHUB_URL } from './WelcomeModal';
import {
  Github, ExternalLink, Cpu, RadioTower, Server, Database, Smartphone,
  Layers, Wrench, Bug, Users, Calendar,
} from 'lucide-react';

/* The engineering write-up behind the product site.

   Reached from the welcome modal and from the "The Project" nav item. Written for
   a recruiter or engineer who followed a resume link and wants to know what was
   actually built, by whom, and what the hard parts were. Every figure here is
   checkable against the git history and the changelog. */

const NUMBERS = [
  { n: '72', l: 'commits, one author' },
  { n: '23.6k', l: 'lines written' },
  { n: '13', l: 'cloud functions' },
  { n: '54', l: 'releases shipped' },
  { n: '5 mo', l: 'concept to production' },
  { n: '$8.1k', l: 'budget managed' },
];

// Each layer carries its own accent so the list reads as a stack rather than
// seven identical green tiles. Hex + '1f' gives a tint that works in both themes.
const STACK = [
  { icon: Cpu, c: '#2ecc71', t: 'Sensor node', d: 'Heltec WiFi LoRa 32 V3 (ESP32-S3) with OLED status screen, deep sleep, and battery plus USB power sensing. Three firmware builds, v1.1 through v5.1.' },
  { icon: Wrench, c: '#f4a52b', t: 'Sensors and actuation', d: 'DS18B20 soil temperature, DHT22 air temperature and humidity, capacitive soil moisture, YF-S201 flow meter. Valve and pump control with timed runs and a self-protecting fault cutoff.' },
  { icon: RadioTower, c: '#a06bff', t: 'Transport', d: 'One firmware image runs either Wi-Fi (MQTT to Losant) or LoRaWAN (OTAA to The Things Stack), switchable at runtime from the app. ThinkNode G1 gateway on US915.' },
  { icon: Server, c: '#13a4ff', t: 'Backend', d: '13 Netlify serverless functions covering device state and history, commands, Wi-Fi and LoRaWAN provisioning, gateway registration, uplink decoding, water accounting, PDF rendering, and OAuth.' },
  { icon: Database, c: '#13a4ff', t: 'Data and auth', d: 'Supabase across five migrations: user accounts, device registry, LoRaWAN route table, gateways, and device photos. Row-level ownership so an account sees only its own plants.' },
  { icon: Layers, c: '#2ecc71', t: 'Web client', d: 'React and Vite, continuously deployed to Netlify on push to main. Live telemetry, history charts, a 113-plant database that auto-tunes alarms, irrigation control, weather, reports, and subscription tiers.' },
  { icon: Smartphone, c: '#a06bff', t: 'Mobile and voice', d: 'A native SwiftUI iOS app running against the same live backend with no backend changes, plus a Google Home cloud-to-cloud integration with OAuth and a fulfillment webhook.' },
];

const HARD_PARTS = [
  {
    t: 'A soil sensor that lied on 3.3V',
    d: 'The capacitive moisture probe read plausibly but wrongly. Its onboard NE555 timer needs more than 4V to oscillate correctly and was browning out on the 3.3V rail. Moved it to 5V and the readings became real.',
  },
  {
    t: 'A GPIO fighting the battery gauge',
    d: 'Analog soil readings drifted for reasons the code could not explain. The board ties GPIO1 into its own battery-sense divider, so the two circuits were loading each other. Relocated the analog input to pin 2.',
  },
  {
    t: 'Eleven bytes for everything',
    d: 'US915 DR0 caps an uplink at 11 bytes. Fitting flow rate, cumulative water total, and valve, fault, and leak status bits meant dropping the raw soil ADC value and reusing moisture 0xFF as a disconnected-probe sentinel.',
  },
  {
    t: 'Provisioning that minted orphans',
    d: 'Every Wi-Fi to LoRaWAN switch generated a fresh DevEUI, so downlinks landed on a device the node had never joined and failed with no_device_session. Rebuilt provisioning to be idempotent: look the board up by its cloud id, reuse stored keys, with a schema migration adding a uniqueness constraint and clearing the v1 orphans.',
  },
  {
    t: 'Silent total data loss',
    d: 'LoRaWAN uplinks vanished while Wi-Fi kept working. Losant rejects an entire state report if it contains one attribute the device does not define, so boards created before the loraRssi, loraSnr, and transport fields existed were dropping every packet. The repeated 502s then made The Things Stack auto-deactivate the webhook. Fix: sync the full attribute schema on every provision so old devices self-heal, plus per-delivery outcome logging so a failure like this is visible next time.',
  },
  {
    t: 'A join setting written to the wrong server',
    d: 'Fresh boards burned a minute of DevNonce retries on first join. resets_join_nonces was being written to the Network Server, which rejects it as a forbidden field-mask path, so it silently never applied. It belongs on the Join Server. Set correctly, a reflashed board joins on the first try.',
  },
];

const TIMELINE = [
  ['Jan 2026', 'Team 15 forms. Division of labor set: hardware to Miami members, software to remote members.'],
  ['Spring 2026', 'Senior Design 1. Board and sensor selection, architecture decisions, prototype bring-up.'],
  ['Jun 2, 2026', 'Build phase opens. First commit to the production repository.'],
  ['Jun 2026', 'Wi-Fi telemetry, accounts, device claiming, alarms, weather, irrigation, and reports ship.'],
  ['Jul 2026', 'LoRaWAN gateway, automated OTAA provisioning, iOS app, water metering, and Google Home land. 54 releases in five weeks.'],
];

export default function ProjectPage({ demo }) {
  return (
    <>
      <header className="landing__pagehead">
        <div className="proj__eyebrow">Senior Design Project · Florida International University · 2026</div>
        <h1>How GrowthPulse was built</h1>
        <p>
          Everything else on this site is written for a customer. This page is written for an
          engineer. GrowthPulse is an end-to-end IoT product: a sensor node in soil, a dual-transport
          link to the cloud, a serverless backend, and consumer web and iOS clients with real
          accounts, alerting, irrigation, and billing tiers.
        </p>
        <div className="proj__links">
          <a className="lbtn lbtn--primary lbtn--small" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <Github size={16} style={{ marginRight: 8 }} /> Source on GitHub
          </a>
          <a className="lbtn lbtn--ghost lbtn--small" href="https://growthpulsecloud.com" target="_blank" rel="noreferrer">
            <ExternalLink size={15} style={{ marginRight: 8 }} /> Live deployment
          </a>
        </div>
      </header>

      <div className="proj__numbers">
        {NUMBERS.map((x) => (
          <div key={x.l}><b>{x.n}</b><span>{x.l}</span></div>
        ))}
      </div>
      <p className="proj__numnote muted">
        Figures come from the production repository's git history and changelog, not from an estimate.
      </p>

      <section className="landing__section">
        <h2>The system, layer by layer</h2>
        <div className="proj__stack">
          {STACK.map((s) => {
            const Icon = s.icon;
            return (
              <div className="proj__layer" key={s.t}>
                <div className="proj__layericon" style={{ background: s.c + '1f', color: s.c }}>
                  <Icon size={19} />
                </div>
                <div>
                  <b>{s.t}</b>
                  <p>{s.d}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="landing__section">
        <div className="proj__sectionhead">
          <Bug size={20} color="#f4a52b" />
          <h2 style={{ margin: 0 }}>The parts that were actually hard</h2>
        </div>
        <p className="proj__subhead">
          Six problems where the fix was not in the code that looked broken. These are the ones worth
          asking about in an interview.
        </p>
        <div className="proj__hard">
          {HARD_PARTS.map((h, i) => (
            <div className="proj__hardcard" key={h.t}>
              <div className="proj__hardnum">{String(i + 1).padStart(2, '0')}</div>
              <b>{h.t}</b>
              <p>{h.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing__section">
        <div className="proj__sectionhead">
          <Calendar size={20} color="#13a4ff" />
          <h2 style={{ margin: 0 }}>Timeline</h2>
        </div>
        <div className="proj__timeline">
          {TIMELINE.map(([when, what]) => (
            <div className="proj__tlrow" key={when}>
              <div className="proj__tlwhen">{when}</div>
              <div className="proj__tlrail" aria-hidden="true"><span /></div>
              <div className="proj__tlwhat">{what}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing__section">
        <div className="proj__sectionhead">
          <Users size={20} color="#2ecc71" />
          <h2 style={{ margin: 0 }}>Who did what</h2>
        </div>
        <p className="proj__subhead">
          A five-person team. Credit below is stated plainly so it can be checked against the
          repository and the project record.
        </p>
        <div className="proj__team">
          {TEAM.map((m) => (
            <div className={`proj__person${m.lead ? ' is-lead' : ''}`} key={m.name}>
              <div className="proj__personrow">
                <b>{m.name}</b>
                <span className="welcome__rolechip">{m.role}</span>
              </div>
              <p>{m.work}</p>
              {m.lead && (
                <div className="proj__leadnote">
                  All 72 commits in the production repository are authored by this account.
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="muted proj__mentor">
          Faculty mentor: Dr. Galarza. Course of record: EEL 4920 and EEL 4921, Spring and Summer 2026.
        </p>
      </section>

      <div className="landing__cta-banner">
        <h3>Want to see it running?</h3>
        <p>The live demo opens instantly with sample plants and every feature unlocked. No account needed.</p>
        <div className="proj__links proj__links--center">
          <button className="lbtn lbtn--white" onClick={demo}>Open the live demo</button>
          <a className="lbtn lbtn--ghostdark" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <Github size={17} style={{ marginRight: 8 }} /> Read the code
          </a>
        </div>
      </div>
    </>
  );
}
