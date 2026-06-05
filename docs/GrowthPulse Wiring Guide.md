# GrowthPulse Node — Wiring & Power Bench Guide

Board: **Heltec WiFi LoRa 32 V3 (ESP32-S3)**
Firmware: `GP_Provisioning.ino` (pins are already set to match this guide)

Everything below is wired exactly to what the firmware expects:
DS18B20 -> GPIO4, DHT22 -> GPIO5, soil moisture AO -> GPIO2 (powered from 5V).

---

## 1. What you need

| Item | Notes |
|------|-------|
| Heltec WiFi LoRa 32 V3 | Your board |
| DS18B20 waterproof probe | Soil temperature (3 wires: red/black/yellow) |
| DHT22 (AM2302) | Air temperature + humidity |
| Capacitive soil moisture sensor | The corrosion-resistant tan/black one, not the cheap forked resistive type |
| 4.7 kΩ resistor | Pull-up for the DS18B20 data line (REQUIRED) |
| 10 kΩ resistor | Pull-up for the DHT22 data line (skip if you have the 3-pin DHT22 module, it is built in) |
| Breadboard + jumper wires | Or solder to a protoboard for a permanent unit |
| USB-C cable | Power, or use your bench supply (see section 2) |

A note on the soil sensor voltage: this capacitive sensor uses an NE555 timer that needs more than ~4V to run, so **power it from 5V, not 3V3** (at 3.3V it reads near zero even though its LED lights). Its analog output tops out around 3V, which is inside the ESP32 ADC's safe range. The DS18B20 and DHT22 still run on 3V3.

---

## 2. Powering the board

The board runs internally at 3.3V but is designed to take **5V in**. Two ways:

### Option A — USB-C (simplest, recommended)
Plug a USB-C cable into a wall charger or your laptop. The onboard regulator makes the 3.3V the chip and sensors need. Done.

### Option B — Bench power supply
Your board has a dedicated **5V** pin on the bottom header (right end, next to a GND pin).
1. Set the supply to **5.0 V**.
2. Set the current limit to about **1.0 A**. The board only draws what it needs (roughly 150 mA idle, with brief ~300-500 mA spikes when WiFi transmits). The 1 A limit is headroom, not a target. Too low a limit causes brownout resets mid-WiFi.
3. Bench supply **+ (red) -> the `5V` pin**, bench supply **- (black) -> the `GND` pin** right next to it. That feeds the onboard regulator just like USB does.

Do not feed 5V into a 3V3 pin. The 3V3 pins are regulated 3.3V, in or out, never 5V.

### Powering the sensors
All three sensors get their power from the board, not the bench supply directly:
- Sensor **VCC -> the board's 3V3 pin**
- Sensor **GND -> the board's GND pin**

The sensors draw only a few milliamps total, so the board's 3V3 rail handles them easily.

---

## 3. Sensor wiring (pin by pin)

### DS18B20 — soil temperature (GPIO4)
| DS18B20 wire | Connects to |
|--------------|-------------|
| Red (VDD) | 3V3 |
| Black (GND) | GND |
| Yellow (DATA) | GPIO4 |

**Required:** a **4.7 kΩ resistor between the yellow DATA wire and 3V3**. This is the 1-Wire bus pull-up. Without it the sensor reports -127°C, which shows up in the app as **-196.6°F**. That is exactly the empty reading you saw, so this resistor is what fixes it.

### DHT22 — air temperature + humidity (GPIO5)
A bare 4-pin DHT22, pins left to right with the grille facing you:
| DHT22 pin | Connects to |
|-----------|-------------|
| 1 (VCC) | 3V3 |
| 2 (DATA) | GPIO5 |
| 3 (NC) | leave unconnected |
| 4 (GND) | GND |

**Pull-up:** a **10 kΩ resistor between DATA (pin 2) and VCC (pin 1)**. If you have the 3-pin DHT22 module (small breakout PCB), it already has this resistor, just wire +, out, and -.

### Capacitive soil moisture — moisture (GPIO2)
| Sensor pin | Connects to |
|------------|-------------|
| VCC | **5V** (not 3V3 — the NE555 timer needs >4V) |
| GND | GND |
| AOUT (AO) | GPIO2 |

No pull-up needed. This is a plain analog voltage the ESP32 reads with its ADC. Powered at 3.3V this sensor reads near zero (raw ~120) even with its LED lit, because the NE555 can't oscillate below ~4V. 5V fixes it, and its output stays under ~3V so the ADC is safe.

---

## 4. Why the soil sensor is on GPIO2 (not GPIO1)

GPIO1 on the V3 is tied to the board's onboard battery-sense circuit, which held the pin at a flat 0 in testing. The soil sensor is therefore on **GPIO2** (`#define SOIL_PIN 2` in the firmware), a clean ADC1 pin one spot to the left of pin 1 on the top row.

Also avoid GPIO19 and GPIO20 for the soil sensor, those are ADC2 pins and the ESP32 cannot read them while WiFi is on.

---

## 5. Calibrating the soil sensor

The firmware converts the raw ADC reading to a percentage using two numbers:

```
dryValue = 3600   // raw reading in air (0% moisture)
wetValue = 1300   // raw reading in water (100% moisture)
```

Once wired, open the Serial Monitor at 115200 and watch the `soilRaw` value:
1. Hold the probe in **dry air** and note the raw number. That is your real `dryValue`.
2. Dip it in a **glass of water** (up to the line, not the electronics) and note the raw number. That is your real `wetValue`.
3. If your two numbers differ much from 3600 / 1300, send them to me and I will drop them into the firmware so the percentage is accurate for your exact sensor.

---

## 6. Power-on check

With everything wired and the board powered:
1. Serial Monitor at 115200 should show real numbers, not `-196.6` and not `nan`.
2. Soil temp and air temp should look like room temperature; humidity like a believable percent.
3. The same values appear in the app within a few seconds for the device claimed as `4A7AC`.

If soil temp is still -196.6°F, recheck the 4.7 kΩ pull-up on the DS18B20 data line. If air temp/humidity are still `nan`, recheck the DHT22 data pin and its pull-up.

---

## Finding the pins on your board (HTIT-WB32LAF)

The pins are silk-screened with their numbers. You do not count GPIOs, you just match labels.

**Top header** (the row that reads `7 6 5 4 3 2 1 ...` from the left). The signal pins live here:
- `5`  -> DHT22 DATA (GPIO5)
- `4`  -> DS18B20 DATA (GPIO4)
- `2`  -> Soil sensor AO (GPIO2, one spot left of pin 1)
- `3V3` (right end, there are two) -> DS18B20 VCC and DHT22 VCC

**Bottom header** (right end reads `... 5V GND`):
- `5V`  -> Soil sensor VCC (and bench-supply + if you use one)
- `GND` -> every sensor's GND (also bench-supply -)

The OLED uses pins 17, 18, 21 and 36 internally, you do not wire anything to those.

## Quick reference

| Sensor | VCC | GND | Signal pin (label) | Pull-up |
|--------|-----|-----|--------------------|---------|
| DS18B20 (soil temp) | 3V3 | GND | `4` | 4.7 kΩ to 3V3 (required) |
| DHT22 (air temp/hum) | 3V3 | GND | `5` | 10 kΩ to 3V3 (or built in) |
| Soil moisture (capacitive) | **5V** | GND | `2` | none |

Board power: USB-C 5V, or bench supply at 5.0V / ~1A into the `5V` and `GND` pins. DS18B20 and DHT22 run on 3V3; the soil sensor needs 5V.
