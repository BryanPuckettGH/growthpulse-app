import { useEffect, useRef, useState } from 'react';
import { euiFromText } from '../utils/eui';
import { X } from 'lucide-react';

// Live camera QR scanner for the gateway EUI. Decodes with jsQR (loaded on
// demand so it never weighs down normal app loads) and hands back the EUI it
// finds inside the code, whatever else the code contains. Falls back
// gracefully when the camera isn't available so the user can always type.
export default function QrScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  // Keep the latest onResult in a ref so the camera effect can run ONCE on mount
  // and never restart when the parent re-renders (the live-polling loop re-renders
  // the Devices view every few seconds; depending on onResult tore the camera
  // down and back up each time, which looked like "won't open / won't scan").
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [err, setErr] = useState('');
  const [note, setNote] = useState('Point the camera at the QR code on the gateway label.');

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let stream = null;

    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      let jsQR;
      try {
        ({ default: jsQR } = await import('jsqr'));
      } catch {
        setErr('Scanner could not load. Type the EUI instead.');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErr('This browser cannot use the camera. Type the EUI instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (e) {
        setErr(e && e.name === 'NotAllowedError'
          ? 'Camera permission is blocked. Allow it in your browser, or type the EUI instead.'
          : 'Could not start the camera. Type the EUI instead.');
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

      const v = videoRef.current;
      if (!v) { stream.getTracks().forEach((t) => t.stop()); return; }
      v.srcObject = stream;
      // Some browsers (notably iOS Safari) reject play() outside the original
      // user gesture; retry on metadata load and ignore the rejection, the frame
      // loop still runs once frames are flowing.
      const tryPlay = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
      v.onloadedmetadata = tryPlay;
      tryPlay();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
        if (cancelled) return;
        if (v.readyState >= v.HAVE_CURRENT_DATA && v.videoWidth) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) {
            const eui = euiFromText(code.data);
            if (eui) { stop(); onResultRef.current(eui); return; }
            setNote('Found a code, but no Gateway EUI in it. Make sure it’s the label QR, or type the EUI.');
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return stop;
  }, []); // run once on mount; never restart on parent re-renders

  return (
    <div className="overlay" style={{ alignItems: 'center' }} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2>Scan gateway QR</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {err ? (
          <p style={{ color: '#e74c3c', fontSize: 13, margin: '6px 2px' }}>{err}</p>
        ) : (
          <>
            <div className="qrframe">
              <video ref={videoRef} autoPlay playsInline muted />
              <div className="qrframe__reticle" />
            </div>
            <p className="muted center" style={{ marginTop: 10 }}>{note}</p>
          </>
        )}
      </div>
    </div>
  );
}
