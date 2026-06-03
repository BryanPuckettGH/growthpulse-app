import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { TIERS, TIER_ORDER } from '../store/tiers';
import { Check } from 'lucide-react';

// Pricing sheet. Demo mode: clicking a plan instantly sets the tier and shows
// a thank-you, unlocking that tier's features across the app.
export default function PlansSheet({ onClose }) {
  const { tierId, setTier } = useApp();
  const [bought, setBought] = useState(null);

  if (bought) {
    const t = TIERS[bought];
    return (
      <div className="overlay" onClick={onClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet__grab" />
          <div className="thanks">
            <div className="thanks__badge" style={{ background: t.color }}><Check size={32} color="#fff" strokeWidth={3} /></div>
            <h2>You&apos;re on {t.name}!</h2>
            <p className="muted">Thanks for upgrading. Everything in {t.name} is unlocked.</p>
            <button className="btn btn--green" style={{ marginTop: 18 }} onClick={onClose}>Start growing</button>
          </div>
        </div>
      </div>
    );
  }

  const buy = (id) => { setTier(id); setBought(id); };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet sheet--tall" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Choose your plan</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 8 }}>Demo mode, no real charge. Buying unlocks the tier instantly.</p>
        <div className="plans">
          {TIER_ORDER.map((id) => {
            const t = TIERS[id];
            const current = id === tierId;
            return (
              <div key={id} className="plan" style={{ borderColor: current ? t.color : undefined }}>
                <div className="plan__head">
                  <div>
                    <div className="plan__name" style={{ color: t.color }}>{t.name}</div>
                    <div className="plan__tag">{t.tagline}</div>
                  </div>
                  <div className="plan__price">{t.price}<span>{t.period}</span></div>
                </div>
                <div className="plan__perks">
                  {t.perks.map((p, i) => (
                    <div className="plan__perk" key={i}><Check size={15} color={t.color} />{p}</div>
                  ))}
                </div>
                {current ? (
                  <button className="btn btn--ghost" disabled>Current plan</button>
                ) : (
                  <button className="btn" style={{ background: t.color, color: '#fff' }} onClick={() => buy(id)}>
                    {id === 'free' ? 'Switch to Free' : `Get ${t.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
