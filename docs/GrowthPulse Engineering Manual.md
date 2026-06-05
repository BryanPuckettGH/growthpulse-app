# 1. System Overview

GrowthPulse is a complete consumer IoT product: a sensor node a customer plugs in and pairs from their phone, a cloud pipeline, and a multi-tenant web application with real accounts, alerts, and subscription tiers. This manual documents every layer of the system, every source file and every significant function, and the reasoning behind every decision. It is an internal document and assumes engineering context.

## 1.1 The data path

```
Sensors (DS18B20, DHT22, capacitive soil probe)
   -> ESP32-S3 firmware (GP_Provisioning.ino)
   -> MQTT over the customer's Wi-Fi
   -> Losant device cloud (stores state, runs alert workflows)
   -> Netlify serverless function device-state.js  (API token held server-side)
   -> React web app at growthpulsecloud.com
   -> the customer
```

## 1.2 The control path

```
App "Factory reset" button
   -> Netlify function device-command.js (write token, allowlisted commands)
   -> Losant command REST API
   -> MQTT command down to the unit
   -> firmware handleCommand(): wipe Wi-Fi credentials, reboot into setup mode
```

## 1.3 The identity chain

```
ESP32 factory MAC (burned in at chip manufacture)
   -> low 24 bits rendered as uppercase hex = pairing code (e.g. 4A7AC)
   -> shown large on the unit's OLED, and embedded in the setup hotspot name
   -> device_registry row in Supabase maps pairing code -> Losant device id
   -> customer types the code in the app -> claim validated -> device on account
```

## 1.4 Services used, and what each one does

| Service | Used for | Link |
|---------|----------|------|
| GitHub | Source control for the web app + serverless functions; pushing to main triggers deploys | github.com/BryanPuckettGH/growthpulse-app |
| Netlify | Hosting for growthpulsecloud.com, build pipeline, serverless functions, environment variables | netlify.com |
| Supabase | User accounts (email/password auth) and the device_registry pairing table | supabase.com |
| Losant | Device cloud: MQTT broker, device state storage, email/SMS alert workflows, command delivery | losant.com |
| Open-Meteo | Weather forecasts and the place-name geocoder used for per-plant home locations. Free, no API key | open-meteo.com |
| Heltec docs | Board documentation, GPIO usage guide for the WiFi LoRa 32 V3 | wiki.heltec.org |
| Silicon Labs | CP210x USB-to-UART driver needed to program the board | silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers |
| Arduino | The IDE used to build and flash the firmware | arduino.cc/en/software |

Credentials policy: no usernames, passwords, keys, or tokens appear in this manual or in git. Live secrets exist in exactly three places: the gitignored `.env` on the development machine, Netlify's environment variable store, and the firmware file (which is kept out of public repositories for that reason).

---

# 2. Getting the Code and Setting Up

## 2.1 The web application

```
git clone https://github.com/BryanPuckettGH/growthpulse-app.git
cd growthpulse-app
npm install
npm run dev          # opens at http://localhost:5173
```

Requires Node.js LTS (nodejs.org). Create a `.env` file in the project root with these variable names (values come from the team's Supabase and Losant dashboards, never from this document):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
LOSANT_API_TOKEN=
LOSANT_APP_ID=
LOSANT_COMMAND_TOKEN=
```

Two things about local development:

- Variables prefixed `VITE_` are compiled into the browser bundle by Vite. Everything else is only readable by the serverless functions. That prefix is the security boundary, never put a secret behind a `VITE_` name.
- `npm run dev` runs Vite only. The serverless functions do not execute, so claimed devices sit at "waiting for first reading" locally. To exercise the full pipeline either use the deployed site or run `netlify dev` (Netlify CLI), which serves the functions too.

Deployment is automatic: any push to `main` triggers a Netlify build (`npm run build`, publish `dist/`, bundle `netlify/functions/` with esbuild, all configured in `netlify.toml`).

## 2.2 The firmware toolchain, from zero

Everything needed to program a unit on a fresh computer:

1. **Arduino IDE 2.x** from arduino.cc/en/software.
2. **USB driver.** The board talks USB through a Silicon Labs CP2102 bridge. Without the driver the board never shows up as a serial port. Install the CP210x Virtual COM Port driver from silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers. On macOS the port then appears as `/dev/cu.usbserial-XXXX`; on Windows as `COMn`.
3. **Board support.** Arduino IDE, Settings, Additional boards manager URLs, add the Espressif index: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`. Then Boards Manager, install **esp32 by Espressif Systems**. Select the board **"Heltec WiFi LoRa 32(V3)"**, not a generic ESP32-S3 profile, the Heltec definition carries the correct flash and pin configuration.
4. **Libraries** (Library Manager, exact names):

| Library | Author | Used for |
|---------|--------|----------|
| WiFiManager | tzapu | Captive-portal Wi-Fi provisioning (release 2.0.17 at time of writing) |
| OneWire | Paul Stoffregen | 1-Wire bus for the DS18B20 |
| DallasTemperature | Miles Burton | DS18B20 temperature conversion |
| DHT sensor library | Adafruit | DHT22 (installs Adafruit Unified Sensor as a dependency) |
| Losant Arduino MQTT Client | Losant | Device cloud connection (installs PubSubClient) |
| ArduinoJson | Benoit Blanchon | Telemetry payloads (v6-style StaticJsonDocument) |
| U8g2 | oliver | The on-board OLED |

5. **Open** `GP_Provisioning/GP_Provisioning.ino` (the folder name must match the file name, an Arduino requirement).
6. **Upload.** Plug in USB-C, pick the port, click Upload. If the upload hangs at "Connecting..." or dies mid-write with "the chip stopped responding," two fixes in order: set Tools, Upload Speed to **115200** (the 921600 default outruns marginal cables), and if needed force download mode by holding **PRG**, tapping **RST**, holding PRG one more second, then uploading.
7. **Serial Monitor** at **115200 baud** shows the boot banner, the pairing code, Wi-Fi progress, and a one-line telemetry summary every cycle, including the raw soil ADC value used for calibration.

## 2.3 What is deliberately not in GitHub

`GP_Provisioning.ino` contains the unit's Losant device id, access key, and access secret, compiled in. One demo unit makes that acceptable; publishing it would not be. The firmware therefore lives in the project folder, not the public repo. The production path (per-unit credentials written at flash time by a provisioning station) is covered in the Roadmap.

---

# 3. Hardware

## 3.1 The board

Heltec WiFi LoRa 32 V3, silkscreen HTIT-WB32LAF. Relevant capabilities:

| Component | Detail |
|-----------|--------|
| MCU | ESP32-S3 dual-core, 240 MHz, 8 MB flash |
| Radios | 2.4 GHz Wi-Fi b/g/n, BLE, and an SX1262 LoRa transceiver (915 MHz US) |
| Display | 0.96 inch SSD1306 OLED, 128x64, on I2C |
| USB | USB-C through a CP2102 UART bridge |
| Buttons | RST (hard reset) and PRG (user button on GPIO0) |
| Power | 5V in via USB-C or the 5V header pin; onboard 3.3V regulator; JST connector for a LiPo battery |

The SX1262 is unused by the current firmware but is the hardware foundation of the LoRaWAN roadmap: the same physical unit becomes a LoRaWAN node with a firmware variant, no new electronics.

## 3.2 Pin assignments, and why each one

| Function | GPIO | Reasoning |
|----------|------|-----------|
| DS18B20 data (1-Wire) | 4 | Listed as free and beginner-safe in Heltec's official GPIO guide |
| DHT22 data | 5 | Same list |
| Soil moisture analog out | 2 | Moved off GPIO1 after bring-up testing: GPIO1 is wired to the board's battery-voltage sense network and read a flat 0 regardless of the sensor. GPIO2 is the adjacent clean ADC1 channel |
| PRG button | 0 | The board's built-in user button; a boot-strapping pin, safe to read after boot |
| OLED SDA / SCL / reset | 17 / 18 / 21 | Fixed by board routing |
| OLED power rail (Vext) | 36 | The V3 feeds the OLED from a switched rail; the firmware must drive GPIO36 LOW to power it. Forgetting this is the classic blank-screen failure |

Analog constraints worth memorizing: analog inputs must use ADC1 channels (GPIO1 through 10) because ADC2 is owned by the Wi-Fi radio while it runs. Resolution is configured to 12 bits, so raw readings span 0 to 4095.

## 3.3 Sensor electronics

### DS18B20, soil temperature

A digital 1-Wire device in a waterproof probe. Wiring: red to 3V3, black to GND, yellow (data) to pin 4, **plus a 4.7 kilo-ohm resistor from the data line to 3V3**. The resistor is not optional and the reason is the bus design: on 1-Wire, the master and every sensor only ever pull the line LOW. Nothing on the bus can drive it high. The pull-up resistor is the only thing that returns the line to 3.3V between pulses. Without it the line never rises, communication is impossible, and the Dallas library returns its "no device" sentinel of -127 C, which converts to the famous **-196.6 F**. The app now recognizes that exact value (section on disconnected-sensor detection) and turns it into a "probe not detected" message naming the resistor.

Each DS18B20 also carries a unique 64-bit serial number whose first byte (the family code) is 0x28. During bring-up we used a 1-Wire scanner sketch that searches the bus and prints these addresses; a found address proves the wiring end-to-end even if temperature conversion were broken, and a storm of random non-0x28 addresses indicates electrical noise on a floating line rather than real devices.

### DHT22, air temperature and humidity

A single-wire (not 1-Wire) digital sensor: VCC to 3V3, data to pin 5, 10 kilo-ohm pull-up from data to VCC (the common 3-pin breakout module has this resistor built in; a bare 4-pin part needs it added). When the sensor is absent the library returns NaN; ArduinoJson serializes NaN as JSON null; the connector passes null through; and the app reads null as "not connected." The failure mode was designed into the pipeline rather than hidden.

### Capacitive soil moisture probe

The flat-blade capacitive probe (v1.2 style): VCC, GND, AO (analog out). Two hard-won findings:

1. **It must be powered from 5V, not 3.3V.** These modules build their oscillator around an NE555 timer, and the NE555 does not run below roughly 4 volts. At 3.3V the power LED lights (LEDs do not care) but the oscillator is dead and AO sits near 0.1V, which reads as raw ~120 and maps to a frozen "100 percent" moisture. Vendors list the modules as 3.3 to 5.5V; the ones with NE555 silicon are 5V parts in practice. At 5V supply the analog output tops out near 3V, which is inside the ESP32 ADC's safe range, so no level shifting or divider is required.
2. **Raw, not percent, is the calibration currency.** The firmware reports both. Calibration procedure: read `raw=` from the Serial line with the probe in dry air (that number becomes `dryValue`, typically near 3600) and submerged to its line in water (`wetValue`, typically near 1300), then update the two constants. Note the inversion: wetter soil means lower raw counts, which is inherent to how the capacitance loads the oscillator.

### Wiring summary

| Sensor | VCC | GND | Signal | Extra |
|--------|-----|-----|--------|-------|
| DS18B20 | 3V3 | GND | pin 4 | 4.7k pull-up, data to 3V3, required |
| DHT22 | 3V3 | GND | pin 5 | 10k pull-up (built into 3-pin modules) |
| Soil moisture | **5V** | GND | pin 2 | none; powered from 5V on purpose |

A printable wiring diagram and a breadboard-level guide live in `docs/GrowthPulse Wiring Diagram.pdf` and `docs/GrowthPulse Wiring Guide.md`.

## 3.4 Power

The board takes 5V in (USB-C from any phone charger, or a bench supply at 5.0V with roughly a 1A current limit feeding the 5V and GND header pins). Measured behavior: about 150 mA idle, with 300 to 500 mA bursts during Wi-Fi transmit; brownout resets during flashing or Wi-Fi joins are a cable or supply problem, not a firmware problem. Sensors draw single-digit milliamps and are powered from the board's regulated rails as in the table above.

**Battery readiness.** Moving the soil probe off GPIO1 had a second benefit: GPIO1 is the battery-sense input, and it is now free. Battery support is therefore a contained firmware task: enable the sense divider, read VBAT, convert to percent, and add `batteryPct` and `charging` to the telemetry JSON. The cloud connector already forwards those two fields and the entire app UI for them (power badges, color thresholds, low-battery insights) is built and waiting.
# 4. Firmware, Section by Section

The firmware is one annotated file, `GP_Provisioning.ino`, about 350 lines. One file is a deliberate choice at this scale: it can be reviewed top to bottom, pasted whole into the IDE, and handed to a teammate without explaining a build system. This chapter walks every section in file order and explains each decision.

## 4.1 Includes and pin definitions

```cpp
#include <WiFi.h>
#include <WiFiManager.h>     // tzapu: captive portal provisioning
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <Losant.h>          // MQTT device client
#include <ArduinoJson.h>
#include <Wire.h>
#include <U8g2lib.h>         // OLED

#define ONE_WIRE_BUS 4       // DS18B20
#define DHTPIN 5             // DHT22
#define DHTTYPE DHT22
#define SOIL_PIN 2           // moved off GPIO1 (battery-sense conflict)
#define RESET_BTN 0          // PRG button

#define VEXT_PIN 36          // LOW powers the OLED rail on the V3
#define OLED_SDA 17
#define OLED_SCL 18
#define OLED_RST 21
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, OLED_RST, OLED_SCL, OLED_SDA);
```

The U8g2 constructor takes rotation, then reset, clock, data. Passing the V3's exact pins matters; the generic constructor assumes default I2C pins and produces a blank screen.

## 4.2 Calibration constants and unit identity

```cpp
int dryValue = 3600;   // raw ADC with the probe in dry air
int wetValue = 1300;   // raw ADC submerged in water

const char* LOSANT_DEVICE_ID    = "...";  // this unit's cloud identity
const char* LOSANT_ACCESS_KEY   = "...";  // values not reproduced here;
const char* LOSANT_ACCESS_SECRET= "...";  // they live only in the firmware file
```

`dryValue` and `wetValue` are intentionally plain globals near the top: they are the two numbers a technician edits after the calibration procedure (section 3.3). The Losant triplet is this single demo unit's identity, compiled in; the production replacement is per-unit credentials written at flash time.

## 4.3 The branded captive portal markup

Two raw-string constants are injected into WiFiManager's portal pages:

- `GP_HEAD`: a `<style>` block restyling the stock portal with brand colors (green buttons, brand typography, soft backgrounds). Injected into every portal page via `setCustomHeadElement`.
- `GP_BRANDING`: a block of HTML carrying the GrowthPulse logo as inline SVG, the wordmark, the SMART PLANT MONITORING tagline, and a "thanks for your purchase" welcome. It rides in as a `WiFiManagerParameter`, which WiFiManager renders at the top of the configuration page.

Why inline SVG: the customer's phone is connected to the device's hotspot with no internet, so the page cannot reference any external image. Everything the portal shows must be served from the chip itself.

## 4.4 Identity helpers

```cpp
String pairCode() {
  char b[8];
  snprintf(b, sizeof(b), "%X", (uint32_t)(ESP.getEfuseMac() & 0xFFFFFF));
  return String(b);
}
String apSsid() {
  char b[24];
  snprintf(b, sizeof(b), "GrowthPulse-%06X", (uint32_t)(ESP.getEfuseMac() & 0xFFFFFF));
  return String(b);
}
```

`ESP.getEfuseMac()` returns the factory-burned MAC, unique per chip, free, and permanent. The low 24 bits are formatted as uppercase hex: `%X` (no leading zeros) for the human pairing code, `%06X` (zero-padded) inside the hotspot SSID so the network name has a consistent shape. The pairing code is the same value the registry stores and the app validates, one identity, three surfaces.

## 4.5 The OLED stack

```cpp
void oledInit() {
  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW);   // power the display rail
  delay(80);                     // let the rail settle before init
  oled.begin();
  oled.setContrast(255);
}
```

`drawBigCentered()` implements adaptive type for the pairing code: it measures the string in FreeUniversal Bold 30, then 25, then 20, and draws with the largest font that fits in 124 px, horizontally centered. The pairing code is the one thing a customer must read off the hardware, so it gets the biggest legible rendering regardless of whether a given chip's code is 5 or 6 characters.

Four screens, all built the same way (clear buffer, set font, draw strings, send buffer):

| Screen | When | Content |
|--------|------|---------|
| `oledMessage(l1, l2)` | transient states | bold headline plus detail line ("Starting up", "Connecting to your Wi-Fi...", "Clearing Wi-Fi") |
| `oledSetup()` | the setup hotspot is open | "Setup - join Wi-Fi:", the SSID bold and centered, "then open the app" |
| `oledStatus(online)` | steady state | "PAIR CODE" header, ON or .. connection chip, the code huge |
| (via `onSetupPortal`) | WiFiManager AP callback | flips to `oledSetup` at the exact moment the portal opens |

The status screen never hides the code after pairing, on purpose: re-pairing, adding to a second account someday, and resale all need it, and it doubles as the unit's serial number.

## 4.6 connectWiFi(), line by line

```cpp
void connectWiFi() {
  WiFiManager wm;
  // (setPreloadWiFiScan needs a newer WiFiManager release; skipped here.)
  wm.setWiFiAutoReconnect(false);  // stop background retries from yanking
                                   // the radio off the hotspot channel
  WiFi.setSleep(false);            // keep the AP responsive to the phone
  wm.setCustomHeadElement(GP_HEAD);
  WiFiManagerParameter gpBranding(GP_BRANDING);
  wm.addParameter(&gpBranding);
  wm.setAPCallback(onSetupPortal);
  wm.setConfigPortalTimeout(600);  // 10 minutes

  String ap = apSsid();
  oledMessage("Connecting to", "your Wi-Fi...");
  if (!wm.autoConnect(ap.c_str())) {
    oledMessage("Setup timed out", "restarting...");
    delay(1500);
    ESP.restart();
  }
  oledStatus(false);
}
```

Reasoning per line:

- **autoConnect** does the whole provisioning policy: try saved credentials; if none or they fail, open the branded hotspot and serve the portal; return true once associated. One call, no custom state machine.
- **setWiFiAutoReconnect(false)** and **WiFi.setSleep(false)** fix a real observed failure: while the portal is open the chip runs AP+STA simultaneously, and both background STA retry scans and modem power-save pull the radio off the AP channel. The symptom is the customer's phone hanging on "connecting..." to the hotspot for a minute or more. With these two lines the join completes in seconds.
- **setConfigPortalTimeout(600)**: the 180-second default expired mid-demo while a phone was slow to pop the portal, restarting the AP underneath the user. Ten minutes gives a human-paced setup window; on timeout the device restarts and reopens setup rather than wedging.
- **setPreloadWiFiScan(true)** would move the network scan before the AP opens (another join-speed win) but the setter only exists in WiFiManager's unreleased development code; release 2.0.17 compiles without it, so it is deliberately omitted with a comment.
- The portal also responds at **192.168.4.1** directly, the documented fallback when a phone suppresses captive-portal detection.

## 4.7 Cloud command handler

```cpp
void handleCommand(LosantCommand *command) {
  if (strcmp(command->name, "factoryReset") == 0) {
    oledMessage("Reset by owner", "clearing Wi-Fi...");
    delay(800);
    WiFiManager wm;
    wm.resetSettings();   // erase stored Wi-Fi credentials
    delay(400);
    ESP.restart();        // boots into the setup hotspot
  }
}
```

Registered once in `setup()` with `device.onCommand(&handleCommand)`. This is the device half of the app's resale flow: the owner taps Factory reset, the cloud delivers `factoryReset` over the existing MQTT connection, and the unit physically prepares itself for the next owner, on its screen, in front of you. Commands reach online devices only; the PRG hold is the offline fallback and the app's confirmation dialog says exactly that. The handler ignores every other command name, an allowlist at the firmware level matching the allowlist in the backend function.

## 4.8 connectLosant()

Connects the MQTT client with the device id, access key, and secret, blocking with a dot-progress loop until connected, with OLED messaging. Losant access keys are device credentials (MQTT) and are distinct from API tokens (REST, used by the backend); the two never mix.

## 4.9 setup()

Order matters and each step has a reason:

1. `Serial.begin(115200)`, `analogReadResolution(12)` (12-bit ADC, 0-4095, matching the calibration constants), PRG configured `INPUT_PULLUP`, a 1-second settle delay.
2. `oledInit()` then a "Starting up" screen, the customer sees life within a second of plugging in.
3. **Boot-time reset check:** if PRG is held LOW right now, wipe Wi-Fi credentials and continue, which lands in the setup portal. This is reset path one of three.
4. Serial banner with the pairing code, for bench work without squinting at the OLED.
5. `ds18b20.begin()`, `dht.begin()`, then `device.onCommand(&handleCommand)` before any connection exists, so no command can ever arrive unhandled.
6. `connectWiFi()` then `connectLosant()`.

## 4.10 readSensors()

```cpp
void readSensors() {
  ds18b20.requestTemperatures();
  soilTemperatureF = ds18b20.getTempFByIndex(0);   // -196.6F when absent

  airTemperatureF = dht.readTemperature(true);      // NaN when absent
  airHumidity = dht.readHumidity();

  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(SOIL_PIN); delay(10); }
  soilRaw = sum / 10;                               // 10-sample average
  soilMoisturePercent = constrain(map(soilRaw, dryValue, wetValue, 0, 100), 0, 100);
}
```

Decisions: sensor failure values pass through untouched (the app turns them into honest UI rather than the firmware guessing); the soil ADC is averaged over 10 samples 10 ms apart because single ESP32 ADC reads jitter by several counts; `map` runs dry-to-wet which inverts the scale correctly since wet soil reads lower; `constrain` clamps readings outside the calibration window instead of reporting 112 percent.

## 4.11 sendTelemetry()

Builds a `StaticJsonDocument<256>` with the five values (`soilTemperatureF`, `airTemperatureF`, `airHumidity`, `soilRaw`, `soilMoisturePercent`) and publishes with `device.sendState`. `soilRaw` ships on purpose: recalibration and the app's floating-probe heuristic both need the raw signal. Serial mirrors a single line per cycle (`Sent moisture=42% raw=2410 airTemp=78.8F`), which is the field calibration tool, no extra software needed.

## 4.12 maybeResetWifi(), reset path two

```cpp
void maybeResetWifi() {
  static unsigned long pressStart = 0;
  if (digitalRead(RESET_BTN) == LOW) {
    if (pressStart == 0) pressStart = millis();
    else if (millis() - pressStart >= 3000) {
      oledMessage("Clearing Wi-Fi", "reopening setup");
      delay(600);
      WiFiManager wm; wm.resetSettings(); delay(400);
      ESP.restart();
    }
  } else {
    pressStart = 0;   // released early: reset the timer
  }
}
```

Hold PRG for 3 seconds at any time while running and the unit wipes Wi-Fi and reboots into setup. This replaced the original hold-PRG-during-RST dance, which demanded sub-second timing customers reliably missed. Design choice: a polled timestamp rather than interrupts, trivially safe alongside two radio stacks, and tolerant of the loop's sensor-read gaps because `pressStart` only clears when the button is actually seen released.

## 4.13 loop()

```cpp
void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!device.connected())          connectLosant();

  readSensors();
  sendTelemetry();
  device.loop();                                   // service MQTT (commands arrive here)
  oledStatus(WiFi.status() == WL_CONNECTED && device.connected());

  unsigned long waitStart = millis();              // 3s between sends, but
  while (millis() - waitStart < 3000) {            // sampled every 20ms so a
    maybeResetWifi();                              // 3s PRG hold is never missed
    delay(20);
  }
}
```

Self-healing first (reconnect either layer that dropped), then read, send, service, display, and a button-aware wait instead of a deaf `delay(3000)`. The 3-second cadence is human-real-time for demos while staying far inside the Losant free tier; battery units will stretch it dramatically.

## 4.14 The diagnostic sketches

Two single-purpose sketches exist for bench debugging and are flashed temporarily over the main firmware:

- **ADC scanner**: prints GPIO 1, 2, 3, 6, 7 raw values side by side twice a second. Used with a jumper test (touch 3V3 to a pin, expect ~4095; touch GND, expect ~0) to prove an ADC pin and to find which pin a wire actually lands on. This is how the GPIO1 battery-sense conflict was isolated.
- **1-Wire scanner**: searches pins 4, 6, 7 for 1-Wire devices and prints their 64-bit addresses. A real DS18B20 announces with family code 0x28; "nothing" on all pins means the probe never reaches the bus (power, contact, or pull-up); a burst of random addresses is line noise being misparsed, which actually proves the pin and code are alive.

Re-flashing the main firmware afterward restores normal operation; Wi-Fi credentials survive in flash across re-flashes unless explicitly reset.
# 5. The Device Cloud (Losant)

Losant (losant.com) is the device-facing cloud: it terminates the MQTT connection from every unit, stores the latest state per device, runs the alert workflows, and delivers commands back down.

## 5.1 Device and attributes

One application contains one device per physical unit. The demo unit is the standalone device "Greenhouse Node" (device id `6a1fb486df527c8bf8d3324b`, not a secret, it appears in claim plumbing). Its attributes mirror the telemetry JSON exactly:

| Attribute | Type | Notes |
|-----------|------|-------|
| airTemperatureF | number | DHT22 |
| airHumidity | number | DHT22 |
| soilTemperatureF | number | DS18B20, carries the -196.6 sentinel when unplugged |
| soilRaw | number | raw soil ADC, kept for calibration and diagnostics |
| soilMoisturePercent | number | the derived percentage |
| batteryPct, charging | number, boolean | reserved for battery firmware; connector already forwards them |

## 5.2 Credentials model: keys vs tokens

Two different credential systems, never interchangeable:

- **Access keys** (key + secret pair) authenticate **devices** over MQTT. The unit's key/secret is compiled into the firmware. Scope: that application's devices.
- **API tokens** authenticate **applications** over REST. Two exist, on purpose:
  - a **read-only token** (scope `all.Application.read`) used by `device-state.js` to read composite state. If it ever leaked, it can only read.
  - a **full-access token** used by `device-command.js` to send commands. It exists separately so the hot, frequently-called read path runs on least privilege.

## 5.3 The wire protocol

- Telemetry up: MQTT publish to `losant/{deviceId}/state` (handled inside the Losant Arduino client by `device.sendState`).
- Commands down: MQTT message on `losant/{deviceId}/command`, surfaced by the client as the `onCommand` callback. Delivery requires the device to be connected at that moment; there is no offline queue, which is why the app's factory-reset dialog documents the PRG fallback.
- State read by the backend: REST `GET /applications/{appId}/devices/{deviceId}/compositeState`, returning per-attribute `{ value, time }` pairs.

## 5.4 Alert workflows (email and SMS)

Built in Losant's visual workflow editor:

```
Device: State trigger  ->  Conditional  ->  Email node (and/or SMS)
```

- The trigger fires on every state report from the device.
- The conditional holds the rule, for example `{{ data.soilMoisturePercent }} < 25`.
- The true branch wires to the Email node (the false branch goes nowhere). A wiring mistake to watch for, learned the hard way: connect the conditional's true output to the email node's input; routing the email node backwards into the conditional silently does nothing.
- **Rate limit:** Losant email sends are limited to one per minute. During testing, two qualifying readings sent seconds apart produced one email, which looked like a failure and was not. SMS goes through the corresponding SMS node where enabled.

These cloud workflows are what make alerts real-world: they fire even when nobody has the app open. The app's in-app alarm system (chapter 8) is a separate, complementary layer.

## 5.5 The simulator

`growthpulse-simulator/simulator.mjs` is a Node script that connects with the same MQTT credentials and publishes realistic randomized telemetry. It built the entire cloud pipeline before hardware existed and remains the demo tool when the physical unit is elsewhere. Operational rule: never run it at the same time as the real board against the same device id, the two sources interleave into nonsense.

---

# 6. Accounts and the Registry (Supabase)

Supabase (supabase.com) provides two things: authentication and the pairing registry.

## 6.1 Authentication

Email/password auth via `@supabase/supabase-js`. Signup attaches profile metadata so the app can address people properly:

```js
supabase.auth.signUp({ email, password,
  options: { data: { first_name, last_name, grower_type } } })
```

The metadata lands in `user.user_metadata` and flows into the UI (greeting name, avatar initial, grower-type badge in Settings). Sessions persist in browser storage and are observed with `onAuthStateChange`, so a refresh never logs anyone out.

## 6.2 The device registry

The full schema, as deployed (also in `docs/growthpulse-supabase-schema.sql`):

```sql
create table if not exists device_registry (
  claim_code         text primary key,
  losant_device_id   text not null,
  created_at         timestamptz default now()
);

alter table device_registry enable row level security;

create policy "authenticated can read registry"
  on device_registry for select
  to authenticated
  using (true);

insert into device_registry (claim_code, losant_device_id)
values ('4A7AC', '6a1fb486df527c8bf8d3324b')
on conflict (claim_code) do nothing;
```

Reading it as a product artifact: this table **is the factory database**. Every manufactured unit gets one row at provisioning time, mapping the code shown on its screen to its cloud identity. Row-level security is the whole access model: authenticated users may look codes up (that is what claiming is), and nobody can write through the public anon key because no insert/update policy exists. Writes happen only through the service role in the dashboard or, later, a provisioning station.

Why the anon key is allowed to be public: it is designed that way by Supabase; RLS policies are the enforcement layer. The key ships in the browser bundle (it is a `VITE_` variable) and grants exactly what the policies say and nothing more.

---

# 7. The Backend (Netlify Functions)

Netlify (netlify.com) hosts the static app and two serverless functions from `netlify/functions/`, bundled with esbuild per `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

The functions exist for exactly one reason: **no Losant token may ever reach a browser.** The app calls same-origin endpoints; the tokens live in Netlify environment variables readable only by function code.

## 7.1 device-state.js, the read path

```js
export const handler = async (event) => {
  const token = process.env.LOSANT_API_TOKEN;       // read-only token
  const appId = process.env.LOSANT_APP_ID;
  const deviceId = event.queryStringParameters?.deviceId;

  if (!token || !appId) return { statusCode: 500, body: '{"error":"Server not configured"}' };
  if (!deviceId)        return { statusCode: 400, body: '{"error":"deviceId required"}' };

  const res = await fetch(
    `https://api.losant.com/applications/${appId}/devices/${deviceId}/compositeState`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { statusCode: res.status, body: '{"error":"Device not found"}' };

  const s = await res.json();
  const num  = (k) => (s[k] && typeof s[k].value === 'number'  ? s[k].value : null);
  const bool = (k) => (s[k] && typeof s[k].value === 'boolean' ? s[k].value : null);
  const reading = {
    airTemperatureF: num('airTemperatureF'),
    airHumidity: num('airHumidity'),
    soilTemperatureF: num('soilTemperatureF'),
    soilRaw: num('soilRaw'),
    soilMoisturePercent: num('soilMoisturePercent'),
    batteryPct: num('batteryPct'),
    charging: bool('charging'),
    time: s.soilMoisturePercent ? new Date(s.soilMoisturePercent.time).getTime() : Date.now(),
  };
  return { statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(reading) };
};
```

Design notes: the `num`/`bool` guards convert anything missing or mistyped into `null`, which is the app's universal "no data" signal, the same null that means an unplugged DHT22. `Cache-Control: no-store` because a stale reading is worse than an extra request for live monitoring. The timestamp rides on the moisture attribute's report time so the app can show data age honestly.

## 7.2 device-command.js, the write path

```js
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, ... };
  const token = process.env.LOSANT_COMMAND_TOKEN;    // separate write token
  const { deviceId, name = 'factoryReset' } = event.queryStringParameters || {};
  if (name !== 'factoryReset') return { statusCode: 400, ... };  // allowlist

  const res = await fetch(
    `https://api.losant.com/applications/${appId}/devices/${deviceId}/command`,
    { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, payload: {} }) });
  ...
};
```

Three defenses: POST only, a one-entry command allowlist, and the dedicated write token. Known and documented gap: the function does not yet verify the caller owns the device; that requires the server-side ownership table (Roadmap item 2) after which the function should check the requester's Supabase JWT against a `devices` table before sending.

## 7.3 Environment variables, the complete set

| Variable | Visible to | Purpose |
|----------|-----------|---------|
| VITE_SUPABASE_URL | browser bundle | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | browser bundle | public anon key; RLS enforces access |
| LOSANT_APP_ID | functions only | Losant application id |
| LOSANT_API_TOKEN | functions only, marked secret | read-only state token |
| LOSANT_COMMAND_TOKEN | functions only, marked secret | command-capable token |

Set in Netlify under Site configuration, Environment variables; locally in the gitignored `.env`. The `VITE_` prefix is the line between public and private, enforced by Vite at build time.

---

# 8. Identity and Claiming, End to End

The complete journey of one unit from factory to a customer's dashboard:

1. **Factory (today: the bench).** Flash the firmware; read the pairing code from the OLED or Serial; create the Losant device and access key; insert the registry row mapping code to device id. For the demo unit: `4A7AC -> 6a1fb486df527c8bf8d3324b`.
2. **Customer Wi-Fi setup.** Power on; the unit opens `GrowthPulse-XXXXXX`; the customer joins from a phone and submits home Wi-Fi on the branded portal; the unit stores credentials, connects, and starts streaming. No app, account, or cloud knowledge involved in this step.
3. **Claim.** In the app: Connect a device, choose Wi-Fi or LoRaWAN gateway, name the plant, type its home city or ZIP, and enter the code from the screen. `claimDevice` uppercases and trims the code, looks it up in `device_registry`, **rejects unknown codes** with a human message, geocodes the home location (failure is non-fatal, weather just falls back), and adds the device with its `losantDeviceId` attached.
4. **Live.** The store's polling loop begins fetching `device-state` for the new device. It renders as "waiting for the first reading" with dashes until real data arrives, never invented numbers, then flips online.

Why a typed code instead of fully automatic binding: during step 2 the phone is on the unit's hotspot with **no internet**, so it cannot reach the account backend to bind silently. A short displayed code typed once is the standard consumer-IoT answer (and what shipped); the zero-typing upgrade, where the portal carries a one-time account token that the unit POSTs to a bind endpoint on first connect, is specced in the Roadmap.

Why validation matters: an early build accepted any string as a pairing code and manufactured a fake-looking device for it. The registry lookup closed that, a typo now produces "That pairing code wasn't recognized" instead of a ghost plant.
# 9. The Web Application, File by File

Stack: React 18 + Vite, recharts for charts, lucide-react for icons, no router (a five-tab state machine), one hand-written CSS design system. This chapter covers every source file.

## 9.1 Entry: index.html and main.jsx

`index.html` carries the PWA surface: `viewport-fit=cover` (content may extend into iPhone safe areas, which the CSS then respects), `theme-color`, the SVG favicon, `manifest.webmanifest`, `apple-touch-icon.png`, and the three Apple metas (`apple-mobile-web-app-capable`, status-bar style, app title) that make Add to Home Screen produce a real full-screen app. `main.jsx` is the standard five-line React root with StrictMode.

## 9.2 supabaseClient.js

Creates the client from the two `VITE_` variables and exports `supabaseConfigured` so the app can render a friendly "accounts service not connected" notice instead of crashing when env vars are missing (fresh clones, CI).

## 9.3 auth/AuthProvider.jsx

A context with `{ user, isDemo, authReady, login, signup, logout, startDemo, configured }`.

- On mount: `getSession()` restores any existing session, then `onAuthStateChange` keeps `user` current; `authReady` gates the first paint so the app never flashes the login for an already-signed-in user.
- `signup(email, password, meta)` forwards profile metadata (first/last name, grower type) into Supabase user metadata.
- **Demo mode** is a parallel fake session: `startDemo()` sets a flag and the provider serves `DEMO_USER { id: 'demo' }` as the effective user. Demo is therefore just another user id to the rest of the app, which is the trick that keeps demo data and real data perfectly separated (see storage namespacing).

## 9.4 App.jsx: Gate and Shell

`Gate` is the top-level decision: unconfigured notice, loading, `<Login/>`, or `<AppProvider key={user.id}><Shell/></AppProvider>`. The `key={user.id}` is load-bearing: changing user identity remounts the entire store so no state can leak between accounts or between demo and real.

`Shell` owns: the tab state machine (`live | history | alarms | devices | settings`), the theme hook (`data-theme` attribute driven by the setting, with an `auto` mode that tracks the OS via `matchMedia`), the app bar (selected device name and location, the share-report button, the avatar), the bottom tab bar (which CSS transforms into a desktop sidebar at 860px), the alarm badge, and the toast system. Toasts work by diffing: each render computes the set of currently tripped alert keys (`deviceId:ruleId`); any key that exists now but not in the previous set raises a 4-second toast naming the device and rule. Diffing keys rather than counts means three simultaneous trips do not collapse into one anonymous notification.

When `devices.length === 0`, Shell returns `<Onboarding/>` instead of the tab UI, the claim-first welcome screen. Onboarding renders inside the full-page centered wrapper, not the shell, because the desktop shell grid once auto-placed it into the 240px sidebar column (a real shipped bug, documented in the runbook).

## 9.5 store/AppContext.jsx, the store

One context provides everything; there is no Redux because one provider with `useCallback` actions is sufficient at this scale.

**Persistence and isolation.** `load`/`save` wrap localStorage with the key scheme `growthpulse:<userId>:<name>`. Combined with the provider remount on user change, every account (and the demo) has fully isolated devices, settings, alarms, journals, gateways, and tier.

**Device model.**

```
{ id, name, location, geo {lat, lon, label}, group, transport: 'wifi'|'lorawan',
  plant, irrigation {mode, targetMoisture, durationSec, enabled, pausedUntil},
  losantDeviceId?,           // present = a real claimed unit
  reading, history[<=60], hasData, online, lastSeen, pumpRunning }
```

`buildDevice` normalizes any persisted shape: legacy `ethernet` transports coerce to `wifi`, defaults fill missing fields, and, critically, **claimed devices initialize with a null reading, `hasData:false`, `online:false`**. They render as "Waiting for the first reading" with dashes. Only the arrival of real cloud data flips them live. Demo devices initialize from `seedReading()` instead. This split exists because an early bug let fake-looking data appear for devices that had never reported.

**The live loop.** One `setInterval` at the user's refresh rate. Each tick: claimed devices are fetched in parallel from `device-state` (errors keep the previous reading; a `devicesRef` lets the closure read current state without re-arming the interval), and demo devices advance via `nextReading`, a bounded random walk. Updates append to a 60-entry rolling history that powers trends and the metric detail charts.

**Weather, pinned to the plant.** The selected device's stored `geo` drives an Open-Meteo forecast call (current temperature and weather code, daily rain probability, UV, high; unit-aware). Only when the device has no geo does the app fall back to browser geolocation, then to a default. The effect re-runs when units or the pinned coordinates change. This is the answer to the vacation problem: the forecast describes where the plant lives, not where the owner is standing.

**Actions, each one line of intent:**

- `addDevice` (demo only): adds a simulated device.
- `claimDevice(code, name, place, transport)`: registry validation, geocode, add. Returns an error string or null, which the claim sheet renders.
- `setDevicePlant`, `updateDevice` (general patch: rename, location with re-geocode handled by the edit sheet, group, transport).
- `removeDevice(id)`: removes the device **and purges** its journal entries and any device-scoped alarm rules. A resold or deleted unit leaves nothing behind.
- `factoryResetDevice(id)`: best-effort POST of the `factoryReset` command, then `removeDevice`. The confirmation dialog carries the data-loss disclaimer and the offline PRG fallback.
- `setIrrigation`, `runPump`: watering state and the simulated pump run (real pump control becomes a Losant command at the backend phase).
- Journal: `addJournalEntry`/`removeJournalEntry`, keyed by device id, entries `{id, date, photo, note}` with photos as downscaled data URLs.
- Gateways: `addGateway`/`removeGateway`, the Farm Kit bookkeeping list.
- Alarms: `addAlarmRule`, `addAlarmRules` (bulk, used by auto-set), `updateAlarmRule`, `removeAlarmRule`.
- `updateSettings`, `setTier`, plans sheet open/close.

The provider also derives the display identity: prefer `user_metadata.first_name + last_name` from signup, fall back to the email prefix, and expose `growerType` for the Settings badge.

## 9.6 store/helpers.js, the domain brain

- `METRICS`: per-metric metadata, label, unit, icon, color, slider min/max, and the default `good`/`warn` bands. `rainChance` exists as a pseudo-metric so rain can participate in the alarm system without being a device sensor.
- `PLANTS` (re-exported from `plants.js`, the searchable catalog with categories, scientific names, emoji, and per-plant range overrides). `rangesForDevice` layers the plant's ranges over the defaults, which is how "ideal" becomes species-relative everywhere at once.
- `statusOf(key, value, ranges)`: inside good = good; inside warn = warn; else critical. This single function colors the entire product.
- `metricConnected(key, reading)`: the disconnected-sensor detector, built from measured failure signatures: soil temperature below -100 (the DS18B20 -127 C sentinel), null values (DHT22 absent), humidity of zero or below (physically impossible from a working DHT22), and soil raw under 300 (a floating or unpowered probe; a real powered probe in air reads near its dry point of ~3600).
- `healthScore`: good=100, warn=66, critical=28, averaged over **connected** metrics only, so a missing probe neither drags down nor props up the score. The weights make a single critical metric visibly hurt (one critical among four healthy reads 82, not 95).
- `recommendations`: ordered advice. Missing-sensor fix-its first (each names the exact pin and component to check), then battery warnings (warn at 20 percent, critical at 10, suppressed while charging or on AC), then plant-care advice derived from the bands, then the all-good line only if nothing else fired.
- `powerInfo`: null `batteryPct` means AC (true for today's USB units); otherwise battery percent plus charging flag.
- Mock generators: `seedReading` and `nextReading` (bounded random walk; soil simulated in raw counts and converted exactly like the firmware does, same DRY/WET constants). `buildSeries` synthesizes hour/day/week/month chart data centered on the plant's ideal band, demo-grade history until long-range queries hit the cloud store (Roadmap).
- `activeAlerts(devices, rules, weather)`: evaluates enabled rules per device (or once against the forecast for `rainChance` rules) and returns the tripped set used by the banner, badge, and toasts. `alarmsFromPlant` generates the one-tap starter rules from the plant's good band.
- Display helpers: `convertTemp`/`displayValue`/`displayUnit` (F-to-C at the display layer only, storage stays Fahrenheit so units switching never mutates data), `trendOf` (last two history points: up, down, flat).
- `TRANSPORTS`: Wi-Fi and LoRaWAN. Ethernet was removed because current hardware has no port; honest options only.

## 9.7 store/tiers.js

Free ($0: 3 devices, core monitoring), Plus ($4.99/mo: 10 devices, weather rain gauge), Pro ($9.99/mo: unlimited, automated irrigation, LoRaWAN positioning). Tiers are feature flags consumed across the app (`tier.weather`, `tier.irrigation`, `tier.deviceLimit`); demo mode runs on pro so prospects see everything; real accounts default to free with polished locked-state upgrade cards.

## 9.8 Components

- **UI.jsx**, the primitive kit: icon maps (`MetricIcon`, `TransportIcon`), `PowerBadge` (AC plug or color-stepped battery icon, compact mode for tight cards), `Pills` (segmented control, supports disabled options with hint tooltips, used for the LoRaWAN-aware refresh rates), `Toggle`, `Slider`, `Stepper`, `Gauge` (the SVG moisture dial), `statusColor`.
- **Login.jsx**: sign-in and sign-up in one card. Signup adds first/last name (side by side), confirm-password with match and minimum-length validation, and the grower-type chip picker; submits metadata through `signup`. Enter submits; errors render inline; the demo button sits under the primary action.
- **Onboarding.jsx**: the empty-account welcome with Connect a device and Log out.
- **ClaimDeviceSheet.jsx**: the pairing flow described in chapter 8, including the Wi-Fi vs gateway chips whose helper text teaches the cadence trade-off (seconds vs minutes, battery life).
- **AddDeviceSheet.jsx**: demo-only simulated device creation.
- **GatewaySheet** (in DevicesView): name plus label code, with plug-into-router guidance.
- **WeatherCard.jsx**: maps Open-Meteo WMO weather codes to label/icon/color (`describe()`), shows temperature, condition, location with a "plant's home" tag when pinned, rain chance and high, plus contextual notes: a rain note suggesting skipped watering at 50 percent or more, a sun/heat note at high UV or heat.
- **Chart.jsx**: the recharts area chart, gradient fill, ideal-band `ReferenceArea`, max and average reference lines, animation off for live data.
- **GrowthJournal.jsx**: photo strip plus timeline sheet; photos are downscaled to thumbnails client-side (`fileToThumb`) before storage so localStorage stays manageable; capture attribute opens the camera on phones.
- **IrrigationCard.jsx**: manual/auto/schedule modes, target-moisture slider, pump duration stepper, Water now (simulated pump bumps moisture), and the rain-pause banner with resume.
- **PlansSheet.jsx**: pricing cards from `TIERS`; in demo, buying sets the tier instantly and shows a thank-you (real billing is a roadmap item and the sheet says so).
- **PlantPicker.jsx**: search across name, scientific name, and category; results grouped by category; each row previews its ideal moisture band; picking re-ranges the whole app via `rangesForDevice`.

## 9.9 Views

- **LiveView**: the dashboard. `HERO` (three headline metrics) and `CHIPS` (four sensor chips) are key arrays mapped against `metricConnected`, connected values render colored by status, disconnected ones render gray dashes and "not connected" and are not tappable. The gauge/health card includes transport, power badge, and location. Weather and irrigation render or show their locked upgrade cards per tier. `RainPausePrompt` offers 24/48-hour watering pauses when rain probability is 50 percent or more. `MetricDetail` is the tap-through chart sheet. `DeviceWaiting` replaces the whole dashboard for a claimed device that has not reported yet.
- **HistoryView**: per-metric cards for HOUR/DAY/WEEK/MONTH with max/avg/min and the ideal band, unit-aware.
- **AlarmsView**: live alert banner and cards, the auto-set button (plant-derived starter rules), and rule cards with enable toggle, device scope dropdown, above/below pills, and a threshold slider bounded by the metric's min/max.
- **DevicesView**: grouped device cards (group headings plus "Other plants"; flat when no groups exist), the gateways section, both add flows, and the edit sheet: name, home location (re-geocoded on save), group (with datalist suggestions from existing groups), connection type with the honest switching note, and the danger zone, Remove and Factory reset, each behind a confirmation screen with explicit data-loss language.
- **SettingsView**: plan card, units, theme, the LoRaWAN-aware refresh-rate pills with the battery-drain note, notification channels (push/email/SMS with addresses), and the account card with name, grower badge, and sign-out.

## 9.10 Utilities

- **geocode.js**: Open-Meteo's free geocoder; returns `{lat, lon, label}` or null; the label ("Davie, Florida") doubles as the device's display location.
- **report.js**: the shareable plant report. Builds a fully self-contained branded HTML document (header, plant identity line with power state and owner, health stat, a sensor table of current values plus min/avg/max computed from in-memory history with sentinels filtered, weather at the plant's home, journal entries with inline data-URL photos), opens it in a new window, and calls `window.print()`. The print dialog supplies Save-as-PDF, paper, and sharing for free, zero client dependencies and perfect fidelity, which is why no PDF library ships in the bundle.

## 9.11 The design system (index.css)

- **Tokens**: `--bg #eef0f2`, `--card #fff`, ink scale (`--ink #2c3e50`, two muted steps), brand `--green #2ecc71` with dark accent `--green-d`, status colors, 22px card radius, layered soft shadows, `--maxw 480px` for the phone column.
- **Layout**: `.shell` is the phone-width column; at 860px it becomes a grid (`240px` sidebar plus content, `grid-template-areas`), the `.tabbar` converts from bottom bar to sidebar, and content widens. The app bar is sticky with backdrop blur.
- **Primitives**: card, badge (now `white-space: nowrap` after a wrapping bug), pills (with disabled state), chips, device cards (meta row wraps as a whole, reading column protected), sheets (bottom drawers with grab handle and slide-up animation, safe-area padded), overlay, toasts, skeletons, the warnbox (destructive confirmations), rolechips (signup picker), danger zone, fieldlabels.
- **Dark theme**: `:root[data-theme='dark']` overrides the token set; `auto` follows the OS.
- **Forms**: `input, select, textarea, button { font-family: inherit }`, browsers default form controls to system fonts with different metrics, which users perceive as "the typing looks shifted."
- **Safe areas**: `env(safe-area-inset-*)` padding on the app bar, tab bar, login, and sheets so the installed PWA clears the iPhone notch and home indicator.

## 9.12 PWA assets

`manifest.webmanifest` (name, standalone display, theme/background colors, 192 and 512 icons with maskable purpose) plus `apple-touch-icon.png` at 180px. The PNGs are rendered from the brand SVG onto a white matte with the sharp library at build-tooling time (iOS renders transparency as black, hence the matte).
# 10. End-to-End Sequences

How the layers cooperate for each major operation, useful as integration documentation and as a debugging map.

**First boot and provisioning.** Power on, OLED "Starting up", boot-time PRG check, banner with pairing code, sensors begin, `connectWiFi()` finds no saved credentials, AP callback flips the OLED to join instructions, customer joins the hotspot, portal serves the branded config page (or 192.168.4.1 manually), credentials saved, association succeeds, OLED shows the pair code with "..", `connectLosant()` brings up MQTT, OLED flips to "ON", telemetry begins on the 3-second cadence.

**Claim.** App: Connect a device, transport choice, name, home place, code. Store: registry SELECT by code (RLS-permitted read), reject or accept, geocode place, add device with `losantDeviceId` and `geo`, select it. UI shows DeviceWaiting until the first poll returns data, then the dashboard goes live.

**Live tick.** Interval fires, claimed devices fetch `device-state` in parallel, nulls and sentinels flow through untouched, readings append to history, trends/health/insights recompute, `metricConnected` decides which slots render as data versus "not connected."

**Alarm trip.** A reading crosses a rule threshold. In-app: `activeAlerts` includes it, the Alarms tab badge and banner update, the Shell's key-diff raises a toast. Out-of-app: the Losant workflow's conditional passes and the email/SMS node fires (subject to the one-per-minute email rate limit). Two independent layers, by design.

**Factory reset.** Edit device, danger zone, Factory reset, confirmation with the disclaimer, `factoryResetDevice`: POST device-command (allowlisted, write token), Losant delivers `factoryReset` over MQTT, firmware shows "Reset by owner", wipes Wi-Fi, reboots into the setup hotspot; meanwhile the app removes the device and purges journal and device-scoped alarms. Offline unit: command is lost, PRG hold covers it, dialog says so.

**Report.** App bar document icon, `openPlantReport` assembles the branded HTML from current state, history stats, weather, and journal, opens a tab, `window.print()`, user saves as PDF or prints.

---

# 11. Debugging Runbook

Every failure below was actually encountered during development. Symptoms are exact.

| Symptom | Cause | Fix |
|---------|-------|-----|
| Soil temperature -196.6 F | DS18B20 absent or, most often, missing/misplaced 4.7k pull-up (it is -127 C, the Dallas disconnected sentinel) | Bridge data and 3V3 with 4.7k; verify probe wiring; the app's insight names this exactly |
| Air temp/humidity nan or null | DHT22 absent or data wire loose | Check pin 5 and the module's pull-up |
| Soil moisture pinned at 100 percent, raw ~120, ignores water | Probe powered at 3.3V: NE555 oscillator dead below ~4V (LED still lights) | Power probe VCC from the 5V pin |
| Soil raw flat 0 on GPIO1 | GPIO1 is the V3 battery-sense net | Use GPIO2 (firmware `SOIL_PIN 2`) |
| Floating ADC reads few-hundred noise, "looks alive" | Nothing driving the pin; ADC noise is normal | Judge by response to known voltage (jumper test: 3V3 reads ~4095, GND ~0), not by presence of a number |
| 1-Wire scanner prints garbage addresses during wire taps | Contact bounce parsed as devices; real DS18B20 addresses start 0x28 | Proves pin and code alive; fix the physical bus |
| Phone hangs "connecting..." to the setup hotspot | AP+STA channel hopping from background retries and modem sleep | `setWiFiAutoReconnect(false)`, `WiFi.setSleep(false)` (in firmware) |
| Captive portal never pops | Phone's portal detection suppressed (cellular data on, OS quirk) | Browse to 192.168.4.1; turning off cellular data helps |
| Portal vanished mid-setup | Old 180 s portal timeout rebooted the AP | Timeout is now 600 s |
| Board keeps joining old Wi-Fi instead of opening setup | Saved credentials still valid | Hold PRG 3 s (or PRG at power-on) to wipe |
| Upload dies: "chip stopped responding", exit status 2 | 921600 baud over a marginal cable | Upload speed 115200; PRG+RST for download mode; better cable |
| No serial port appears at all | CP210x driver missing | Install Silicon Labs CP210x VCP driver |
| `setPreloadWiFiScan` compile error | Setter absent from released WiFiManager (2.0.17) | Delete the line; the other two portal fixes carry the load |
| Compile error: a file path inside the code | Accidental paste into the editor buffer | The error's caret points at it; delete the line |
| Cloud email alert "didn't fire" | One-per-minute Losant email rate limit, or spam folder | Space test readings a minute apart |
| 404 "Application not found" from Losant REST | Token JWT subject is not the application id | App id comes from the dashboard URL, not from inside the token |
| Junk pairing code created a device (historic) | No validation | Registry lookup now rejects unknown codes |
| Claimed device shows fake-looking values (historic) | Devices seeded with simulated data | Claimed devices now start empty and honest |
| Welcome screen squeezed against the left edge on desktop (historic) | Onboarding rendered inside the shell grid, auto-placed into the 240px sidebar cell | Onboarding uses the full-page centered wrapper |
| Badge text wraps mid-word, card columns collide (historic) | Meta row could not wrap; badges could break internally | `white-space: nowrap` on badges, wrapping meta row, protected reading column |
| Typed text in fields looks subtly off | Form controls default to system fonts | `input/select/textarea/button { font-family: inherit }` |
| Plant report tab never opens | Popup blocked | Allow popups for growthpulsecloud.com once |

---

# 12. Decision Log

| Decision | Reasoning |
|----------|-----------|
| Pairing code derived from the chip MAC and shown on the OLED | Unique per unit with zero provisioning cost; the customer reads it off the device; doubles as a serial number |
| Registry table validates every claim | Typos cannot create ghost devices; the table is the future factory database |
| Soil sensor on GPIO2 | GPIO1 is wired to battery sense; measured flat 0 |
| Soil probe powered at 5V | NE555 modules do not oscillate below ~4V; output stays ADC-safe |
| Sentinels pass through the pipeline untouched | The app converts them to honest "not connected" UI with fix-it hints; hiding them would mask hardware faults |
| Claimed devices start with no data | Never display invented numbers; trust is the product |
| Weather pinned to a per-device geocoded home | The forecast must follow the plant, not the traveling owner |
| Health score excludes disconnected sensors; weights 100/66/28 | A missing probe must not bias the score; one critical metric must visibly hurt |
| Two Losant API tokens (read-only and command) | Least privilege on the hot read path |
| All cloud tokens live in serverless functions | No credential ever ships in a browser bundle; `VITE_` prefix is the boundary |
| Command endpoint allowlists `factoryReset` | Bounds the blast radius of an as-yet-unauthenticated endpoint |
| Factory reset = cloud command + local purge + explicit disclaimer | A resale flow that physically readies the unit and leaves no data behind |
| Portal: 10-minute timeout, no auto-reconnect, no modem sleep | Fixes the observed slow-join and mid-setup restart failures |
| PRG 3-second hold replaces the PRG+RST timing dance | Customers reliably failed sub-second button choreography |
| Per-user localStorage namespacing plus provider remount on user change | Account isolation on shared browsers, and demo isolation for free |
| Demo as a fake user id rather than a flag sprinkled through code | One mechanism gives complete data separation |
| Ethernet removed from the UI | Current hardware has no port; honest options only |
| LoRaWAN-aware refresh options with battery notes | The UI teaches the trade-off where the user makes the choice |
| Reports via the browser print pipeline | Zero dependencies; Save-as-PDF, paper, and share for free |
| One-file firmware | Reviewable top to bottom; trivially flashable and handover-friendly at this scale |

---

# 13. Known Limitations and Roadmap

1. **Per-unit cloud provisioning.** All flashed units currently share the demo unit's cloud identity. Production requires a flash-time provisioning station: generate per-unit Losant credentials, write them to the unit, create the cloud device, insert the registry row, print packaging.
2. **Server-side device ownership.** Claims live in per-account browser storage. A `devices(user_id, losant_device_id, claim_code)` table with RLS makes ownership cloud-authoritative, syncs across browsers, enforces claim exclusivity, and lets `device-command` verify the caller owns the target before sending.
3. **Zero-typing auto-bind.** The portal carries a one-time account token; the unit POSTs it to a bind endpoint on first connect. Claim codes are the shipping-grade interim.
4. **LoRaWAN bring-up.** The SX1262 is on every board and a 915 MHz gateway (ThinkNode G1) is in hand: LoRaWAN firmware variant, a network server (The Things Stack or ChirpStack), webhook into the existing pipeline, transport switching via cloud command, and the app's gateway section binding to real gateway status.
5. **Battery telemetry.** GPIO1 sense plus `batteryPct`/`charging` in the JSON; every consumer of those fields already exists.
6. **Durable history.** Charts draw from the 60-reading in-memory ring; long-range views should query Losant's time-series store through a new function.
7. **Web push notifications** for alarm trips, complementing cloud email/SMS.
8. **Billing.** Tiers are functional feature gates; Stripe integration replaces the demo "buy" path.
9. **Family sharing.** Multiple accounts per garden, after item 2.

---

# 14. Appendix

## 14.1 Links

| Resource | URL |
|----------|-----|
| Live app | https://growthpulsecloud.com |
| App repository | https://github.com/BryanPuckettGH/growthpulse-app |
| Netlify | https://www.netlify.com |
| Supabase | https://supabase.com |
| Losant | https://www.losant.com |
| Open-Meteo (forecast + geocoding) | https://open-meteo.com |
| Heltec V3 docs | https://wiki.heltec.org |
| ESP32 Arduino boards index | https://espressif.github.io/arduino-esp32/package_esp32_index.json |
| CP210x USB driver | https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers |
| Arduino IDE | https://www.arduino.cc/en/software |

## 14.2 Project file inventory

| Path | Contents |
|------|----------|
| `growthpulse-app/` | The web app and serverless functions (this repo deploys the product) |
| `GP_Provisioning/GP_Provisioning.ino` | Unit firmware (kept out of public git) |
| `growthpulse-simulator/simulator.mjs` | MQTT telemetry simulator |
| `docs/GrowthPulse User Manual.(md/pdf)` | Customer-facing manual |
| `docs/GrowthPulse Engineering Manual.(md/pdf)` | This document |
| `docs/GrowthPulse Wiring Guide.md`, `docs/GrowthPulse Wiring Diagram.pdf` | Bench wiring references |
| `docs/growthpulse-supabase-schema.sql` | Registry schema |
| `docs/GrowthPulse Product Roadmap.md`, `docs/GrowthPulse Deployment Model.md` | Product strategy docs |
| `README.md` (repo) | Developer onboarding |

## 14.3 Identifier reference (non-secret)

| Identifier | Value |
|------------|-------|
| Demo unit pairing code | 4A7AC |
| Demo unit hotspot | GrowthPulse-04A7AC |
| Demo Losant device id | 6a1fb486df527c8bf8d3324b |
| Serial baud | 115200 |
| Portal fallback address | 192.168.4.1 |

Access keys, access secrets, API tokens, and the Supabase anon key are intentionally absent from this document. They live in the firmware file, the gitignored `.env`, and Netlify's environment store.

---

GrowthPulse Engineering, internal and confidential. Keep credentials out of documents and repositories.
