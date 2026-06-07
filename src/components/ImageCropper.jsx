import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

// Square crop tool. Shows the picked image inside a square window; the user
// drags to reposition and uses the slider (or pinch / wheel) to zoom, then we
// render just the visible square to a small JPEG data URL. Pure canvas + a
// little pointer math, no library.
const BOX = 280;   // on-screen crop window (px)
const OUT = 512;   // output thumbnail size (px)

export default function ImageCropper({ src, onCancel, onDone }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // top-left of the scaled image, relative to the box
  const [minZoom, setMinZoom] = useState(1);
  const drag = useRef(null);
  const pinch = useRef(null);

  // Load the image and frame it so it fills the square to start.
  useEffect(() => {
    const im = new Image();
    im.onload = () => {
      const base = Math.max(BOX / im.width, BOX / im.height); // "cover" the box
      setImg(im);
      setMinZoom(base);
      setZoom(base);
      setPos({ x: (BOX - im.width * base) / 2, y: (BOX - im.height * base) / 2 });
    };
    im.src = src;
  }, [src]);

  // Keep the image covering the box (no empty gaps) as zoom/position change.
  const clamp = (p, z) => {
    if (!img) return p;
    const w = img.width * z;
    const h = img.height * z;
    return {
      x: Math.min(0, Math.max(BOX - w, p.x)),
      y: Math.min(0, Math.max(BOX - h, p.y)),
    };
  };

  const applyZoom = (z, center) => {
    if (!img) return;
    const nz = Math.max(minZoom, Math.min(minZoom * 4, z));
    const cx = center ? center.x : BOX / 2;
    const cy = center ? center.y : BOX / 2;
    // zoom around the focal point so it stays put
    const k = nz / zoom;
    const nx = cx - (cx - pos.x) * k;
    const ny = cy - (cy - pos.y) * k;
    setZoom(nz);
    setPos(clamp({ x: nx, y: ny }, nz));
  };

  const onPointerDown = (e) => {
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches;
      pinch.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
      return;
    }
    const pt = e.touches ? e.touches[0] : e;
    drag.current = { sx: pt.clientX, sy: pt.clientY, px: pos.x, py: pos.y };
  };
  const onPointerMove = (e) => {
    if (pinch.current && e.touches && e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      applyZoom(pinch.current.zoom * (dist / pinch.current.dist));
      e.preventDefault();
      return;
    }
    if (!drag.current) return;
    const pt = e.touches ? e.touches[0] : e;
    setPos(clamp({ x: drag.current.px + (pt.clientX - drag.current.sx), y: drag.current.py + (pt.clientY - drag.current.sy) }, zoom));
    e.preventDefault();
  };
  const onPointerUp = () => { drag.current = null; pinch.current = null; };

  const onWheel = (e) => { applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92)); };

  const save = () => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUT, OUT);
    // Map the on-screen box (BOX) to the output (OUT). The source rect is the
    // part of the original image currently under the crop window.
    const scale = OUT / BOX;
    const sx = -pos.x / zoom;
    const sy = -pos.y / zoom;
    const sSize = BOX / zoom;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
    onDone(canvas.toDataURL('image/jpeg', 0.8));
  };

  return (
    <div className="overlay" style={{ alignItems: 'center' }} onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2>Crop photo</h2>
          <button className="iconbtn" onClick={onCancel} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="muted" style={{ marginTop: -6 }}>Drag to reposition, pinch or use the slider to zoom.</p>

        <div
          className="cropbox"
          style={{ width: BOX, height: BOX }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
          onWheel={onWheel}
        >
          {img && (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: img.width * zoom,
                height: img.height * zoom,
                maxWidth: 'none',
                userSelect: 'none',
              }}
            />
          )}
          <div className="cropbox__ring" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 4px' }}>
          <ZoomIn size={16} color="var(--ink-3)" />
          <input
            type="range" min={minZoom} max={minZoom * 4} step={0.01} value={zoom}
            onChange={(e) => applyZoom(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>

        <button className="btn btn--green" onClick={save}>Use photo</button>
        <button className="btn btn--ghost" style={{ marginTop: 8 }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
