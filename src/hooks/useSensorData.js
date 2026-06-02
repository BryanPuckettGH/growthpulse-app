import { useState, useEffect, useRef } from 'react';

/* ============================================================
   useSensorData
   ------------------------------------------------------------
   This is the ONE place data comes from. Today it generates
   realistic fake readings every couple seconds so we can build
   and see the UI without the hardware/cloud being wired up.

   LATER (when your node is sending to Losant), you only change
   the marked SWAP POINT below. The dashboard never changes.
   ============================================================ */

// Soil calibration values copied from the node firmware (node.ino),
// so the mock moisture % is computed the exact same way the board does.
const DRY_VALUE = 3600; // raw ADC reading when bone dry
const WET_VALUE = 1300; // raw ADC reading when soaked

// Arduino-style map(): rescale a number from one range to another.
function mapRange(x, inMin, inMax, outMin, outMax) {
  return ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Produce one believable reading that drifts slightly from the last one,
// so the chart looks like real sensor noise instead of random jumps.
function makeMockReading(prev) {
  const soilRaw = Math.round(
    clamp((prev?.soilRaw ?? 2400) + (Math.random() * 200 - 100), WET_VALUE, DRY_VALUE)
  );
  const soilMoisturePercent = Math.round(
    clamp(mapRange(soilRaw, DRY_VALUE, WET_VALUE, 0, 100), 0, 100)
  );
  const soilTemperatureF = +clamp((prev?.soilTemperatureF ?? 68) + (Math.random() - 0.5), 60, 80).toFixed(1);
  const airTemperatureF = +clamp((prev?.airTemperatureF ?? 73) + (Math.random() - 0.5), 65, 85).toFixed(1);
  const airHumidity = +clamp((prev?.airHumidity ?? 50) + (Math.random() - 0.5) * 2, 30, 70).toFixed(1);

  return {
    soilTemperatureF,
    airTemperatureF,
    airHumidity,
    soilRaw,
    soilMoisturePercent,
    time: Date.now(),
  };
}

export function useSensorData({ intervalMs = 2000, historyLength = 30 } = {}) {
  const [current, setCurrent] = useState(() => makeMockReading());
  const [history, setHistory] = useState(() => [makeMockReading()]);
  const currentRef = useRef(current);

  useEffect(() => {
    const id = setInterval(() => {
      // ================= SWAP POINT =================
      // TODAY: make a fake reading.
      // LATER: fetch the real reading from Losant, for example:
      //
      //   const res = await fetch(
      //     `https://api.losant.com/applications/${APP_ID}/devices/${DEVICE_ID}/state`,
      //     { headers: { Authorization: `Bearer ${TOKEN}` } }
      //   );
      //   const json = await res.json();
      //   const next = { ...mapLosantStateToReading(json), time: Date.now() };
      //
      // As long as `next` has the same field names, nothing else changes.
      const next = makeMockReading(currentRef.current);
      // ==============================================

      currentRef.current = next;
      setCurrent(next);
      setHistory((h) => [...h, next].slice(-historyLength));
    }, intervalMs);

    return () => clearInterval(id); // stop the timer if the page closes
  }, [intervalMs, historyLength]);

  return { current, history };
}
