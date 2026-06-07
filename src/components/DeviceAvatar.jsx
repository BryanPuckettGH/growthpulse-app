import { PLANTS } from '../store/helpers';
import { Sprout } from 'lucide-react';

// A device's picture: the owner's uploaded photo if set, otherwise the plant
// emoji, otherwise a generic sprout. Shared by device cards, the dashboard
// plant bar, and the edit sheet so the look is consistent everywhere.
export default function DeviceAvatar({ device, size = 46, radius = 14, fallbackColor = '#2ecc71' }) {
  const base = { width: size, height: size, borderRadius: radius, flexShrink: 0 };
  if (device && device.photo) {
    return <img src={device.photo} alt={device.name || ''} style={{ ...base, objectFit: 'cover', display: 'block' }} />;
  }
  const plant = PLANTS[device && device.plant] || PLANTS.generic;
  return (
    <div style={{ ...base, background: fallbackColor + '1a', display: 'grid', placeItems: 'center' }}>
      {plant.emoji
        ? <span style={{ fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{plant.emoji}</span>
        : <Sprout size={Math.round(size * 0.48)} color={fallbackColor} />}
    </div>
  );
}
