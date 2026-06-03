import { useState } from 'react';
import { PLANT_LIST, PLANT_CATEGORIES } from '../store/plants';

// Searchable plant catalog. Type to filter by common name, scientific name,
// or category; pick one and the device's ranges auto-adjust.
export default function PlantPicker({ current, onPick, onClose }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const results = PLANT_LIST.filter((p) => {
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      p.scientific.toLowerCase().includes(query) ||
      PLANT_CATEGORIES[p.category].label.toLowerCase().includes(query)
    );
  });

  const byCat = {};
  results.forEach((p) => { (byCat[p.category] = byCat[p.category] || []).push(p); });

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet sheet--tall" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2>Choose a plant</h2>
        <input className="input" placeholder="Search plants by name..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="plantlist">
          {results.length === 0 && (
            <p className="muted center" style={{ padding: '24px 0' }}>No plants match “{q}”.</p>
          )}
          {Object.entries(byCat).map(([cat, items]) => (
            <div key={cat}>
              <div className="section-title" style={{ marginTop: 10 }}>{PLANT_CATEGORIES[cat].label}</div>
              {items.map((p) => (
                <button key={p.id} className={`plantrow ${current === p.id ? 'active' : ''}`} onClick={() => onPick(p.id)}>
                  <span className="plantrow__emoji">{p.emoji}</span>
                  <span className="plantrow__txt">
                    <span className="plantrow__name">{p.name}</span>
                    <span className="plantrow__sci">{p.scientific}</span>
                  </span>
                  <span className="plantrow__range">{p.ranges.soilMoisturePercent.good[0]}–{p.ranges.soilMoisturePercent.good[1]}%</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
