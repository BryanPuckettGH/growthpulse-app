# GrowthPulse Water Sensor Guide

**Sensor:** YF-S201 hall-effect flow sensor · **Firmware:** GP_Final v5.1+ · **Pin:** GPIO47

## Why this exists

The flow sensor closes the loop on watering. Before it, the system commanded the valve and hoped; now it *measures*. That enables four things: proof that water actually moved during a run, an automatic shutoff + warning when it didn't (empty reservoir, kinked line, dead pump), a leak warning when water moves with the valve closed, and real usage totals the app turns into daily/weekly/monthly water costs.

## Sensor facts (from the datasheet)

| Property | Value |
|---|---|
| Type | Hall effect, pulse output |
| Supply | 5 to 18 V DC (min working 4.5 V), 15 mA @ 5 V |
| Output | 5 V TTL square wave, ~50% duty |
| Pulse rate | F (Hz) = 7.5 × flow (L/min) → **450 pulses per liter** |
| Range | 1 to 30 L/min, ±10% |
| Max pressure | 2.0 MPa |
| Fittings | 1/2" nominal pipe thread |

## Wiring: read this before touching the board

The ESP32-S3 on the Heltec V3 is **NOT 5V tolerant**. The YF-S201's yellow signal wire swings to 5V, so it must go through a voltage divider. Connecting it straight to GPIO47 risks the pin (and eventually the board).

```
YF-S201 red    ──────────────  5V  (Heltec 5V pin; present when USB/AC powered)
YF-S201 black  ──────────────  GND
YF-S201 yellow ──[ 10k ]──┬──  GPIO47
                          │
                        [ 20k ]
                          │
                         GND
```

The 10k/20k divider turns 5V pulses into ~3.3V (5 × 20/30). The 20k lower leg also ties GPIO47 to ground when the sensor is unplugged, so a dangling pin can't count phantom pulses. Any resistor pair with a ~1:2 ratio in the 5k–50k range works (e.g. 4.7k/10k gives 3.4V, also fine).

Two practical notes. First, the sensor needs 5V, which the Heltec only supplies on USB/AC power; on battery alone the flow sensor reads zero. The irrigation build is wall-powered anyway, so this doesn't change anything. Second, mount the sensor with the arrow pointing in the flow direction, upstream of the valve if you want leak detection to see a stuck-open valve, downstream if you only care about metering the plant line. Upstream of the drip emitters, either way.

## What the firmware does with it

Every pulse fires an interrupt; once a second the firmware converts the count into a live flow rate (450 pulses = 1 L) and adds it to three counters: the current run, the lifetime total (saved to flash every 2 L and at the end of each run, so reboots don't lose it), and the amount not yet saved.

**No-flow watchdog.** When the valve opens, the firmware waits 8 seconds for the line to fill. If flow is still under 0.5 L/min after that, it closes the valve itself, shows **NO WATER FLOW** on the OLED, and reports `flowFault` to the app, where a default-on alarm and a red banner pick it up. The fault stays latched until a later watering actually sees water, so the app keeps warning until the problem is really fixed.

**Leak watchdog.** If water flows at 0.3+ L/min for 30 straight seconds while the valve is closed, the node reports `leakDetected`. It clears itself when the flow stops.

**Calibration.** The sensor is ±10%. To trim it, run water into a measured jug, compare against the app's session total, and adjust `FLOW_CALIBRATION` in GP_Final.ino (e.g. jug says 2.0 L, app says 1.8 L → set 1.11).

## Telemetry

Wi-Fi mode adds six fields to every report: `flowLpm`, `waterSessionL`, `waterTotalL`, `valveOpen`, `flowFault`, `leakDetected`. LoRaWAN mode packs flow, total, and the three status bits into the new 11-byte v2 uplink (the webhook decodes v1 and v2 by length).

**One-time step for existing boards:** Losant silently drops state for attributes a device doesn't define. Devices provisioned before v5.1 need the new attributes added once:

```
LOSANT_API_TOKEN=<token> LOSANT_APP_ID=<appId> node scripts/add-water-attributes.mjs
```

New devices get the attributes automatically from `provision-device`.

## Cost tracking in the app

Settings → Water: pick gallons or liters and enter the price per 1,000 (it's on the utility bill as $/1,000 gal or per m³). The Water card on the Live view then prices today / this week / this month. Usage is computed the way a utility meter is read, by diffing the lifetime counter, so missed samples never lose water, and a re-flashed node (counter reset) is handled.
