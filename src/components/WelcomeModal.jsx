import { useEffect } from 'react';
import { X, Github, ArrowRight, Cpu, Linkedin } from 'lucide-react';

/* Visitor welcome overlay for the public site.

   growthpulsecloud.com is linked from Bryan's resume and personal site, so most
   first-time visitors are recruiters or hiring managers, not customers. The
   product site alone doesn't tell them what they came to find out: who built
   this, when, and what the engineering actually was. This modal answers that in
   the first five seconds and then sends them one of two ways: browse the product
   as a customer would, or go straight to the engineering write-up.

   Laid out in two columns on desktop (the note on the left, the credits on the
   right) so it reads as a short letter rather than a tall wall of text.

   Shown on every page load, dismissed for the rest of the browser session. */

export const TEAM = [
  {
    name: 'Bryan Puckett',
    role: 'Team lead',
    work: 'Node firmware, hardware bring-up and debugging, LoRaWAN gateway and provisioning, serverless backend, database, this web app, the native iOS app, and the Google Home integration.',
    lead: true,
  },
  { name: 'Jaime', role: 'Hardware', work: 'Soldered prototype board, sensor mounting, CAD enclosure.' },
  { name: 'Stella', role: 'Media', work: 'Project videos and presentation materials.' },
  { name: 'Raymond', role: 'Research', work: 'LoRaWAN and network topology research, written progress reports.' },
  { name: 'Yasel', role: 'Reporting', work: 'Budget, parts research, report contributions.' },
];

export const GITHUB_URL = 'https://github.com/BryanPuckettGH/growthpulse-app';

// Left empty the link simply does not render, so an unset value can never ship a
// dead link to a recruiter. Both the overlay and the project page read this.
export const LINKEDIN_URL = 'https://www.linkedin.com/in/bryan-puckett/';

export default function WelcomeModal({ onClose, onSeeProject }) {
  // Esc closes, and the page behind shouldn't scroll while the overlay is up.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="welcome__backdrop" onClick={onClose}>
      <div
        className="welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="welcome__x" onClick={onClose} aria-label="Close">
          <X size={17} />
        </button>

        <div className="welcome__head">
          <div className="welcome__avatar">BP</div>
          <div>
            <div className="welcome__eyebrow">A message from the team lead</div>
            <div className="welcome__signname">Bryan Puckett</div>
            <div className="welcome__signrole">Team Lead · Team 15 · Florida International University</div>
            {LINKEDIN_URL && (
              <a className="welcome__li" href={LINKEDIN_URL} target="_blank" rel="noreferrer">
                <Linkedin size={13} /> Connect on LinkedIn
              </a>
            )}
          </div>
        </div>

        <div className="welcome__body">
          <div className="welcome__msg">
            <h2 id="welcome-title" className="welcome__title">
              Welcome to Growth<span>Pulse</span>
            </h2>
            <p>
              Thanks for stopping by. GrowthPulse is a working IoT product, not a mockup, built as
              the 2026 senior design project of <b>Team 15</b> at Florida International University.
              The site you're on is the real one: real accounts, real sensor hardware in real soil,
              real cloud backend. It isn't a company. It's a student-built system we took all the way
              to production.
            </p>
            <p>
              I led the team and personally built the software and connectivity stack, from the
              firmware on the board up through this web app. If you're here from my resume, the
              second button below is the one you want.
            </p>
          </div>

          <div className="welcome__team">
            <div className="welcome__teamhead">Team 15 · FIU Senior Design · 2026</div>
            {TEAM.map((m) => (
              <div className={`welcome__member${m.lead ? ' is-lead' : ''}`} key={m.name}>
                <div className="welcome__memberid">
                  <b>{m.name}</b>
                  <span className="welcome__rolechip">{m.role}</span>
                </div>
                <p>{m.work}</p>
              </div>
            ))}
            <div className="welcome__mentor">Faculty mentor: Dr. Galarza</div>
          </div>
        </div>

        <div className="welcome__foot">
          <div className="welcome__ctas">
            <button className="lbtn lbtn--ghost" onClick={onClose}>
              Browse the product site
            </button>
            <button className="lbtn lbtn--primary" onClick={onSeeProject}>
              <Cpu size={17} style={{ marginRight: 8 }} />
              See how it was built
              <ArrowRight size={16} style={{ marginLeft: 8 }} />
            </button>
          </div>
          <a className="welcome__gh" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <Github size={15} /> Or go straight to the source on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
