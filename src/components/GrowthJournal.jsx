import { useState, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { fileToThumb } from '../utils/image';
import { Camera, Trash2 } from 'lucide-react';

// Per-device growth journal: add downscaled photos + notes and view them as a
// timeline. Photos are stored small in the browser for the demo; full-size
// cloud storage comes with the backend.
export default function GrowthJournal() {
  const { selectedDevice, journals, addJournalEntry, removeJournalEntry } = useApp();
  const entries = journals[selectedDevice.id] || [];
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const photo = await fileToThumb(file);
      addJournalEntry(selectedDevice.id, { photo, note: note.trim() });
      setNote('');
    } catch {
      // ignore unreadable files
    }
    setBusy(false);
  };

  return (
    <>
      <div className="section-title">Growth journal</div>
      <div className="card">
        {entries.length === 0 ? (
          <p className="muted center" style={{ padding: '6px 0 12px' }}>No photos yet. Snap your plant to start a growth timeline.</p>
        ) : (
          <div className="journalstrip">
            {entries.slice(0, 8).map((en) => (
              <button key={en.id} className="journalthumb" onClick={() => setOpen(true)}>
                <img src={en.photo} alt="" />
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: entries.length ? 12 : 0 }}>
          <input className="input" placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 0 }} />
          <button className="btn btn--green" style={{ width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }} disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
            <Camera size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />{busy ? 'Adding...' : 'Add photo'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />

        {entries.length > 0 && (
          <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>View timeline ({entries.length})</button>
        )}
      </div>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="sheet sheet--tall" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            <h2>Growth timeline</h2>
            <div className="plantlist">
              {entries.length === 0 && <p className="muted center" style={{ padding: '24px 0' }}>No entries yet.</p>}
              {entries.map((en) => (
                <div className="jentry" key={en.id}>
                  <img className="jentry__img" src={en.photo} alt="" />
                  <div className="jentry__body">
                    <div className="jentry__date">{new Date(en.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    {en.note && <div className="jentry__note">{en.note}</div>}
                  </div>
                  <button className="jentry__del" onClick={() => removeJournalEntry(selectedDevice.id, en.id)} aria-label="Delete entry"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
