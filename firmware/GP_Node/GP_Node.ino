/* ============================================================
   GrowthPulse Node Firmware  v3.11  (SELF-PROVISIONING)
   ------------------------------------------------------------
   Board: Heltec WiFi LoRa 32 V3 (ESP32-S3)
   Wiring: DS18B20 -> GPIO4, DHT22 -> GPIO5, Soil AO -> GPIO2 (5V)
   Libraries: WiFiManager (tzapu), OneWire, DallasTemperature,
     DHT sensor library, Losant Arduino MQTT, ArduinoJson, U8g2

   *** This firmware has NO per-board secrets. ***
   Every board runs this IDENTICAL image. On first connect the board
   asks the GrowthPulse backend to provision it: it sends its pairing
   code (derived from the chip MAC) + a shared firmware token, and gets
   back its OWN Losant device id + access key, which it saves to flash
   (NVS). So you can flash 1 board or 1,000 and each shows up as its own
   plant. "Mail a customer a board" works with one image.

   Reset Wi-Fi any time: hold PRG for 3 seconds (no RST needed),
   hold PRG while powering on, OR factory-reset from the app.

   Power button (PRG): double-tap to turn OFF (deep sleep, ~uA);
   a single PRG press (or RESET) turns it back ON.
   ============================================================ */

#include <WiFi.h>
#include <WiFiManager.h>
#include <WiFiClientSecure.h>    // HTTPS to the provisioning endpoint
#include <HTTPClient.h>
#include <Preferences.h>         // store the provisioned Losant creds in flash (NVS)
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <Losant.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <esp_task_wdt.h>        // hardware watchdog: auto-reboot on a hang
#include <esp_sleep.h>           // deep-sleep "power off" + wake on the PRG button

// ----------------- Pins -----------------
#define ONE_WIRE_BUS 4
#define DHTPIN 5
#define DHTTYPE DHT22
#define SOIL_PIN 2                // Soil on GPIO2 (GPIO1 is tied to battery-sense)
#define RESET_BTN 0               // PRG button (GPIO0): hold 3s to redo Wi-Fi setup

#define FW_VERSION "3.11"         // optional VBUS sense on GPIO7 -> true USB vs battery
#define WDT_TIMEOUT_S 60          // reboot if the firmware hangs this long
#define DIM_AFTER_MS (5UL * 60UL * 1000UL)  // dim the OLED after 5 idle minutes
#define SELFTEST_HOLD_MS 10000    // hold the sensor self-test on screen this long to read it

// How this unit reaches the cloud, shown on screen so the customer can SEE it.
// This firmware build is Wi-Fi. A future LoRaWAN build flips LINK_LABEL to
// "LoRaWAN" (and replaces the Wi-Fi stack), so the screen always tells the truth.
#define LINK_LABEL "Wi-Fi"
#define PAGE_MS 5000              // cycle the status screen every ~5 seconds
#define PAGE_COUNT 3             // pair code -> connection -> live readings

// ----------------- Battery (Heltec V3) -----------------
// The V3 senses battery voltage on GPIO1 through a divider gated by GPIO37.
// GPIO1 is free here because the soil sensor lives on GPIO2. The /238.7 factor
// and the discharge curve are the community-calibrated values from the
// ropg/heltec_esp32_lora_v3 library (a naive voltage->% is quite inaccurate).
#define VBAT_CTRL 37
#define VBAT_ADC  1
static const float BAT_MIN_V = 3.04, BAT_MAX_V = 4.26;

// ----------------- USB-power sense (OPTIONAL hardware mod) -----------------
// The V3 exposes no USB/charge signal, so by default the firmware can only guess
// power state from battery voltage (imperfect: a board on USB with no battery reads
// a charger-held voltage that looks like a real pack). To fix it for real, add a
// 100k/100k divider from the board's 5V pin to GND with the midpoint on GPIO7, then
// set USE_VBUS_SENSE to 1: the firmware then KNOWS when USB is plugged in
// (midpoint ~2.5V) vs running on battery (0V).
#define USE_VBUS_SENSE 0          // set to 1 ONLY on boards that have the divider wired
#define VBUS_ADC 7                // GPIO7 (A6): reads the divider midpoint
static const uint8_t BAT_CURVE[100] = {
  254,242,230,227,223,219,215,213,210,207, 206,202,202,200,200,199,198,198,196,196,
  195,195,194,192,191,188,187,185,185,185, 183,182,180,179,178,175,175,174,172,171,
  170,169,168,166,166,165,165,164,161,161, 159,158,158,157,156,155,151,148,147,145,
  143,142,140,140,136,132,130,130,129,126, 125,124,121,120,118,116,115,114,112,112,
  110,110,108,106,106,104,102,101, 99, 97,  94, 90, 81, 80, 76, 73, 66, 52, 32,  7,
};
int batteryPct = -1;       // -1 until first read (and when no battery is connected)
bool charging = false;     // inferred from voltage trend (no charge-status pin on the V3)
float battVSmooth = -1;    // slow EMA of battery voltage, reference for the trend test

// ----------------- On-board OLED (Heltec V3) -----------------
#define VEXT_PIN 36
#define OLED_SDA 17
#define OLED_SCL 18
#define OLED_RST 21
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, OLED_RST, OLED_SCL, OLED_SDA);

// ----------------- Soil calibration -----------------
int dryValue = 3600;
int wetValue = 1300;

// ----------------- Self-provisioning config (same on EVERY board) -----------------
// On first boot the board POSTs its pairing code + this shared token to the
// provisioning endpoint and receives its own Losant device id + access key,
// which it stores in NVS. No per-board secrets live in this file.
#define PROVISION_URL   "https://growthpulsecloud.com/.netlify/functions/provision-device"
#define PROVISION_TOKEN "REPLACE-WITH-SHARED-FIRMWARE-TOKEN"   // == Netlify env PROVISION_TOKEN

// Filled in at runtime from NVS (or from a fresh provision on first boot).
String losantDeviceId, losantAccessKey, losantAccessSecret;
Preferences nvs;

// ----------------- Branded setup portal -----------------
const char* GP_HEAD = R"GPHTML(
<style>
body{background:#eef0f2;color:#2c3e50;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
button,input[type=submit],input[type=button]{background:#2ecc71!important;border:none!important;color:#fff!important;border-radius:12px!important;font-weight:600;padding:11px!important;}
input[type=text],input[type=password],select{border:1px solid #dfe3e8!important;border-radius:10px!important;padding:10px!important;}
a{color:#1a9b5a!important;}
h1,h2,h3{color:#2c3e50!important;}
.gp-brand{text-align:center;padding:14px 0 6px;}
.gp-brand h2{font-size:24px;margin:8px 0 2px;font-weight:800;letter-spacing:-0.5px;}
.gp-brand .pulse{color:#2ecc71;font-weight:400;}
.gp-brand .tag{letter-spacing:2px;font-size:11px;color:#7f8c8d;margin:2px 0 8px;}
.gp-brand .welcome{color:#5f6b76;font-size:14px;line-height:1.4;}
</style>
)GPHTML";

const char* GP_BRANDING = R"GPHTML(
<div class="gp-brand">
<svg width="60" height="60" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<path d="M100 155 Q100 115 105 95 Q108 78 100 58" stroke="#1A9B5A" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M102 90 Q68 60 52 38 Q70 45 88 62 Q94 68 98 80" fill="#2ECC71" opacity="0.85"/>
<path d="M104 70 Q135 32 155 15 Q140 42 125 60 Q115 72 106 78" fill="#2ECC71"/>
<path d="M30 155 L70 155 L82 155 L92 140 L100 170 L110 128 L120 162 L128 148 L136 155 L170 155" stroke="#2ECC71" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
<h2>Growth<span class="pulse">Pulse</span></h2>
<div class="tag">SMART PLANT MONITORING</div>
<div class="welcome">Welcome, and thanks for your purchase! Choose your Wi-Fi below to bring your plant online.</div>
</div>
)GPHTML";

// ----------------- Objects -----------------
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);
DHT dht(DHTPIN, DHTTYPE);

WiFiClient wifiClient;
LosantDevice* device = nullptr;   // created after we know our device id (post-provision)

// ----------------- Sensor values -----------------
float soilTemperatureF = 0.0;
float airTemperatureF = 0.0;
float airHumidity = 0.0;
int soilRaw = 0;
int soilMoisturePercent = 0;

// Screen burn-in protection state.
unsigned long lastInteraction = 0;
bool oledDimmed = false;

// Rotating status screen state.
int screenPage = 0;
unsigned long lastPageSwitch = 0;

// ============================================================
// On-board OLED helpers
// ============================================================
// The pairing code must be UNIQUE per board. The efuse MAC's low 24 bits are
// the manufacturer OUI (identical across Espressif chips), so we use the HIGH
// 24 bits, the per-chip NIC id, which differs on every board.
uint32_t chipUid() {
  return (uint32_t)((ESP.getEfuseMac() >> 24) & 0xFFFFFF);
}

String pairCode() {
  char b[8];
  snprintf(b, sizeof(b), "%06X", chipUid());
  return String(b);
}

String apSsid() {
  char b[24];
  snprintf(b, sizeof(b), "GrowthPulse-%06X", chipUid());
  return String(b);
}

// True when USB power is present, read from the optional 5V -> 100k -> GPIO7 ->
// 100k -> GND divider. Returns false when the mod isn't built (USE_VBUS_SENSE 0).
bool usbPlugged() {
#if USE_VBUS_SENSE
  return analogReadMilliVolts(VBUS_ADC) > 1000;   // midpoint ~2.5V plugged, ~0V on battery
#else
  return false;
#endif
}

// Battery percent from the V3's calibrated discharge curve. Returns -1 when no
// real battery is on the V3's dedicated LiPo connector (e.g. USB-powered), so
// the app shows "AC power" instead of a false "Battery 0%".
int readBatteryPercent() {
  pinMode(VBAT_CTRL, OUTPUT);
  digitalWrite(VBAT_CTRL, HIGH);  // this board enables the divider with HIGH (verified on the bench;
  delay(100);                     //   the documented LOW reads 0 here). 100ms to settle.
  long acc = 0;                   // average 16 samples to quiet ADC noise (needed for trend below)
  for (int i = 0; i < 16; i++) { acc += analogRead(VBAT_ADC); delay(2); }
  pinMode(VBAT_CTRL, INPUT);      // release to save power
  float raw = acc / 16.0f;
  float v = raw / 238.7f;         // Heltec V3 calibration -> volts
  if (v < 2.5f) {                 // implausibly low = no battery on the connector
    charging = false;
    Serial.printf("Battery: adc=%.0f  vbat=%.2fV  (no battery)\n", raw, v);
    return -1;
  }
  // ---- charging / power state ----
  // EMA gives a slow reference; v above it = climbing (current flowing in), below = draining.
  if (battVSmooth < 0) battVSmooth = v;
  float dv = v - battVSmooth;
  battVSmooth += 0.20f * (v - battVSmooth);

#if USE_VBUS_SENSE
  // A REAL "USB plugged in" signal on GPIO7. Trust it: never report "on battery"
  // while plugged in, which is what the voltage-only guess gets wrong.
  bool plugged = usbPlugged();
  if (!plugged) {
    charging = false;                          // truly on battery -> show the real %
  } else if (v >= 4.18f && dv < 0.004f) {
    charging = false;                          // plugged + topped off -> on wall power
    Serial.printf("Battery: vbat=%.2fV  AC (USB, full)\n", v);
    return -1;
  } else {
    charging = true;                           // plugged + not full -> charging
  }
  Serial.printf("Battery: vbat=%.2fV  %s  [VBUS:%s]\n", v, charging ? "CHARGING" : "battery", plugged ? "USB" : "batt");
#else
  // No VBUS wire: infer power state from voltage alone (best effort).
  if      (dv >  0.006f)  charging = true;   // voltage rising -> on the charger
  else if (v  >= 4.18f)   charging = true;   // pinned at the charger's top -> plugged in / topping off
  else if (dv < -0.006f)  charging = false;  // falling -> running on the battery
  // pinned high & flat = full-and-plugged OR no battery on USB -> report AC, not a phantom %
  if (v >= 4.22f && dv < 0.004f) {
    charging = false;
    return -1;
  }
  Serial.printf("Battery: adc=%.0f  vbat=%.2fV  %s\n", raw, v, charging ? "CHARGING" : "on battery");
#endif
  // ---- raw percent from the calibrated discharge curve ----
  int rawPct = 0;
  float step = (BAT_MAX_V - BAT_MIN_V) / 256.0f;
  for (int n = 0; n < 100; n++) {
    if (v > BAT_MIN_V + step * BAT_CURVE[n]) { rawPct = 100 - n; break; }
  }
  // ---- smooth the shown percent so it never jumps ----
  // A charger inflates the terminal voltage the instant it connects, so a 44%
  // pack would read ~65%. Move the displayed value at most 1% per read: while
  // charging it only rises; on battery it eases toward the true reading.
  static int displayedPct = -1;
  if (displayedPct < 0)  displayedPct = rawPct;                       // first read: adopt
  else if (charging)   { if (rawPct > displayedPct) displayedPct++; } // creep up only
  else                 { if (rawPct > displayedPct) displayedPct++;
                         else if (rawPct < displayedPct) displayedPct--; }
  return displayedPct;
}

void oledInit() {
  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW);
  delay(80);
  oled.begin();
  oled.setContrast(255);
}

void drawBigCentered(const char* s, int baseline) {
  const uint8_t* fonts[] = { u8g2_font_fub30_tr, u8g2_font_fub25_tr, u8g2_font_fub20_tr };
  for (uint8_t i = 0; i < 3; i++) {
    oled.setFont(fonts[i]);
    int w = oled.getStrWidth(s);
    if (w <= 124) { oled.drawStr((128 - w) / 2, baseline, s); return; }
  }
  oled.setFont(u8g2_font_fub20_tr);
  int w = oled.getStrWidth(s);
  oled.drawStr(w < 128 ? (128 - w) / 2 : 0, baseline, s);
}

void oledMessage(const char* l1, const char* l2) {
  oled.clearBuffer();
  oled.setFont(u8g2_font_7x13B_tr);
  oled.drawStr(2, 28, l1);
  oled.setFont(u8g2_font_6x12_tr);
  if (l2 && l2[0]) oled.drawStr(2, 50, l2);
  oled.sendBuffer();
}

void oledSetup() {
  String ap = apSsid();
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(2, 10, "Setup - join Wi-Fi:");
  oled.setFont(u8g2_font_7x13B_tr);
  int w = oled.getStrWidth(ap.c_str());
  oled.drawStr(w < 128 ? (128 - w) / 2 : 0, 37, ap.c_str());
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(2, 58, "then open the app");
  oled.sendBuffer();
}

// Draw a string ending at x (right-aligned), handy for value columns.
void drawRight(int x, int y, const char* s) {
  oled.drawStr(x - oled.getStrWidth(s), y, s);
}

// A small header row shared by the detail pages: title left, link state right.
void pageHeader(const char* title, bool online) {
  oled.setFont(u8g2_font_6x12_tr);
  oled.drawStr(2, 11, title);
  oled.setFont(u8g2_font_6x10_tr);
  drawRight(126, 10, online ? LINK_LABEL : LINK_LABEL " --");
  oled.drawHLine(0, 14, 128);
}

// Page 0: the big pairing code, with the live link state in the corner.
void pagePairCode(bool online) {
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(2, 9, "PAIR CODE");
  drawRight(126, 9, online ? LINK_LABEL " ON" : LINK_LABEL " ..");
  drawBigCentered(pairCode().c_str(), 56);
  oled.sendBuffer();
}

// Page 1: how it's connected, signal, address, and battery level.
void pageConnection(bool online) {
  oled.clearBuffer();
  pageHeader("CONNECTION", online);
  oled.setFont(u8g2_font_6x10_tr);
  char val[24];
  oled.drawStr(2, 28, "Link");
  drawRight(126, 28, LINK_LABEL);
  if (online) {
    snprintf(val, sizeof(val), "%ld dBm", (long)WiFi.RSSI());
    oled.drawStr(2, 41, "Signal");
    drawRight(126, 41, val);
  } else {
    oled.drawStr(2, 41, "Connecting...");
  }
  oled.drawStr(2, 54, charging ? "Charging" : "Battery");
  if (batteryPct >= 0) snprintf(val, sizeof(val), charging ? "%d%% +" : "%d%%", batteryPct);
  else snprintf(val, sizeof(val), "AC/USB");   // no battery on the sense connector
  drawRight(126, 54, val);
  oled.sendBuffer();
}

// Page 2: the live sensor readings, disconnected probes shown honestly as "--".
void pageReadings() {
  oled.clearBuffer();
  pageHeader("LIVE READINGS", true);
  oled.setFont(u8g2_font_6x10_tr);
  char val[24];

  oled.drawStr(2, 28, "Air");
  if (!isnan(airTemperatureF) && !isnan(airHumidity) && airHumidity > 0)
    snprintf(val, sizeof(val), "%.1fF %.0f%%", airTemperatureF, airHumidity);
  else snprintf(val, sizeof(val), "--");
  drawRight(126, 28, val);

  oled.drawStr(2, 41, "Soil temp");
  if (soilTemperatureF > -100) snprintf(val, sizeof(val), "%.1fF", soilTemperatureF);
  else snprintf(val, sizeof(val), "--");
  drawRight(126, 41, val);

  oled.drawStr(2, 54, "Moisture");
  if (soilRaw > 300) snprintf(val, sizeof(val), "%d%%", soilMoisturePercent);
  else snprintf(val, sizeof(val), "--");
  drawRight(126, 54, val);

  oled.sendBuffer();
}

// Show whichever page is current in the rotation.
void oledShowPage(int page, bool online) {
  switch (page) {
    case 1:  pageConnection(online); break;
    case 2:  pageReadings();         break;
    default: pagePairCode(online);   break;
  }
}

// Backward-compatible alias used right after Wi-Fi connects: show page 0.
void oledStatus(bool online) {
  screenPage = 0;
  lastPageSwitch = millis();
  pagePairCode(online);
}

// OLED burn-in protection: dim after idle, restore on any button press.
void oledWake() {
  lastInteraction = millis();
  if (oledDimmed) {
    oled.setContrast(255);
    oledDimmed = false;
  }
}

void updateScreenPower() {
  bool shouldDim = millis() - lastInteraction > DIM_AFTER_MS;
  if (shouldDim && !oledDimmed) {
    oled.setContrast(20);
    oledDimmed = true;
  }
}

// Boot self-test: prove each probe answers before going online, and show the
// result like a manufacturing POST screen. "--" means check that sensor.
void bootSelfTest() {
  ds18b20.requestTemperatures();
  bool soilT = ds18b20.getTempCByIndex(0) > -100;   // -127 = not found

  float at = dht.readTemperature();
  if (isnan(at)) {                                   // DHT22 needs ~2s after begin()
    delay(2200);
    at = dht.readTemperature();
  }
  bool air = !isnan(at);

  long rsum = 0; int rmn = 4095, rmx = 0;            // sample to judge connected vs floating
  for (int i = 0; i < 8; i++) { int r = analogRead(SOIL_PIN); rsum += r; if (r < rmn) rmn = r; if (r > rmx) rmx = r; delay(5); }
  int raw = rsum / 8;
  bool moist = (raw > 300) && ((rmx - rmn) < 600);    // present AND steady = really connected

  oled.clearBuffer();
  oled.setFont(u8g2_font_6x12_tr);
  oled.drawStr(2, 11, "Self-test   v" FW_VERSION);
  oled.drawHLine(0, 14, 128);
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(2, 28, soilT ? "Soil temp      OK" : "Soil temp      --");
  oled.drawStr(2, 41, air   ? "Air sensor     OK" : "Air sensor     --");
  oled.drawStr(2, 54, moist ? "Moisture       OK" : "Moisture       --");
  oled.sendBuffer();

  Serial.printf("Self-test: soilTemp=%s air=%s moisture=%s (raw=%d)\n",
                soilT ? "OK" : "missing", air ? "OK" : "missing", moist ? "OK" : "missing", raw);
  delay(SELFTEST_HOLD_MS);   // runs before the watchdog is armed, so a long hold is safe
}

void onSetupPortal(WiFiManager* mgr) {
  oledWake();
  oledSetup();
}

// ============================================================
// Wi-Fi provisioning via captive portal
// ============================================================
void connectWiFi() {
  WiFiManager wm;
  // (setPreloadWiFiScan needs a newer WiFiManager release; skipped here.)
  wm.setWiFiAutoReconnect(false);  // stop background retries from yanking the radio off-channel
  WiFi.setSleep(false);            // keep the AP responsive to the phone
  // If the board still holds credentials for a network it can't reach (e.g. a
  // reused unit, or after a move), don't wait forever on that, give up after
  // 15s and open the setup hotspot. A returning unit on its real network still
  // reconnects well within this.
  wm.setConnectTimeout(15);
  wm.setCustomHeadElement(GP_HEAD);
  WiFiManagerParameter gpBranding(GP_BRANDING);
  wm.addParameter(&gpBranding);
  wm.setAPCallback(onSetupPortal);
  wm.setConfigPortalTimeout(600);  // 10 min before the portal gives up and reboots

  String ap = apSsid();
  Serial.println();
  Serial.print("Starting Wi-Fi. If unconfigured, join the hotspot: ");
  Serial.println(ap);
  oledMessage("Connecting to", "your Wi-Fi...");

  // The setup portal may legitimately stay open for minutes; take this task
  // off the watchdog while it does, then put it back.
  esp_task_wdt_delete(NULL);
  bool ok = wm.autoConnect(ap.c_str());
  esp_task_wdt_add(NULL);

  if (!ok) {
    Serial.println("Wi-Fi setup timed out. Restarting...");
    oledMessage("Setup timed out", "restarting...");
    delay(1500);
    ESP.restart();
  }

  Serial.println("Wi-Fi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  oledStatus(false);
}

// ============================================================
// Cloud commands (sent from the app)
// ============================================================
// "factoryReset": the owner reset this unit from the app (selling or
// gifting it). Wipe the saved Wi-Fi and reboot into the setup hotspot
// so the new owner can pair it fresh.
void handleCommand(LosantCommand *command) {
  Serial.print("Cloud command: ");
  Serial.println(command->name);
  if (strcmp(command->name, "factoryReset") == 0) {
    oledMessage("Reset by owner", "clearing Wi-Fi...");
    delay(800);
    WiFiManager wm;
    wm.resetSettings();
    delay(400);
    ESP.restart();
  }
}

// ============================================================
// Self-provisioning: get this board its own Losant identity
// ============================================================
// On first boot (no saved creds) the board calls the GrowthPulse backend with
// its pairing code + the shared firmware token and receives its own Losant
// device id + access key/secret, then stores them in NVS. Every subsequent
// boot just loads them from flash. This is why one identical image works for
// every board.
bool provisionFromBackend() {
  oledMessage("First-time setup", "registering device");
  WiFiClientSecure tls;
  tls.setInsecure();   // TLS without cert pinning (fine for bring-up; pin in production)

  HTTPClient http;
  if (!http.begin(tls, PROVISION_URL)) return false;
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<192> req;
  req["code"] = pairCode();
  req["token"] = PROVISION_TOKEN;
  String reqBody;
  serializeJson(req, reqBody);

  int code = http.POST(reqBody);
  if (code != 200) {
    Serial.printf("Provision failed, HTTP %d: %s\n", code, http.getString().c_str());
    http.end();
    return false;
  }
  String resp = http.getString();
  http.end();

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, resp)) return false;
  losantDeviceId    = (const char*)(doc["deviceId"]     | "");
  losantAccessKey   = (const char*)(doc["accessKey"]    | "");
  losantAccessSecret= (const char*)(doc["accessSecret"] | "");
  if (losantDeviceId == "" || losantAccessKey == "" || losantAccessSecret == "") return false;

  nvs.begin("gp", false);
  nvs.putString("ldid", losantDeviceId);
  nvs.putString("lkey", losantAccessKey);
  nvs.putString("lsec", losantAccessSecret);
  nvs.end();
  Serial.print("Provisioned. Losant device id: ");
  Serial.println(losantDeviceId);
  return true;
}

// Load saved creds, or provision if this is the board's first boot. Retries
// provisioning until it succeeds (needs Wi-Fi up first).
void ensureProvisioned() {
  nvs.begin("gp", true);
  losantDeviceId     = nvs.getString("ldid", "");
  losantAccessKey    = nvs.getString("lkey", "");
  losantAccessSecret = nvs.getString("lsec", "");
  nvs.end();

  if (losantDeviceId == "" || losantAccessKey == "" || losantAccessSecret == "") {
    while (!provisionFromBackend()) {
      esp_task_wdt_reset();
      Serial.println("Retrying provisioning in 5s...");
      oledMessage("Setup retry", "check internet");
      delay(5000);
    }
  } else {
    Serial.print("Loaded saved Losant identity: ");
    Serial.println(losantDeviceId);
  }
  // Now we know our device id; create the Losant client and wire commands.
  device = new LosantDevice(losantDeviceId.c_str());
  device->onCommand(&handleCommand);
}

// ============================================================
// Losant connection
// ============================================================
void connectLosant() {
  Serial.print("Connecting to Losant");
  oledMessage("Connecting to", "GrowthPulse cloud");
  device->connect(wifiClient, losantAccessKey.c_str(), losantAccessSecret.c_str());
  while (!device->connected()) {
    esp_task_wdt_reset();   // retrying the cloud is intentional, not a hang
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("Connected to Losant");
}

// ============================================================
// Setup
// ============================================================
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  pinMode(RESET_BTN, INPUT_PULLUP);
  delay(1000);

  // Did we just wake from the deep-sleep "off" state (PRG press), or is this a
  // real cold boot / reset? Used so a wake-press doesn't get mistaken for the
  // "hold PRG at boot to wipe Wi-Fi" gesture below.
  bool wokeFromSleep = (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT1);

  oledInit();
  oledMessage(wokeFromSleep ? "Waking up" : "Starting up", "GrowthPulse");

  // Hold PRG while powering on to forget Wi-Fi and reopen setup. Skipped when we
  // woke from deep sleep, otherwise the wake-press would wipe Wi-Fi every time.
  if (!wokeFromSleep && digitalRead(RESET_BTN) == LOW) {
    Serial.println("PRG held at boot: clearing saved Wi-Fi, reopening setup...");
    oledMessage("Clearing Wi-Fi", "reopening setup");
    WiFiManager wmReset;
    wmReset.resetSettings();
    delay(800);
  }

  Serial.println();
  Serial.println("=================================");
  Serial.println("GrowthPulse Node");
  Serial.print("Unit ID (pairing code): ");
  Serial.println(pairCode());
  Serial.println("=================================");

  ds18b20.begin();
  dht.begin();

  lastInteraction = millis();
  bootSelfTest();

  // Hardware watchdog: if the firmware ever hard-hangs, reboot instead of
  // sitting dead until someone notices the plant data stopped.
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t wdtCfg = {
    .timeout_ms = WDT_TIMEOUT_S * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true,
  };
  esp_task_wdt_reconfigure(&wdtCfg);
#else
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
  esp_task_wdt_add(NULL);

  connectWiFi();
  ensureProvisioned();   // first boot: register this board + get its own Losant identity
  connectLosant();
}

// ============================================================
// Sensor reads
// ============================================================
void readSensors() {
  ds18b20.requestTemperatures();
  soilTemperatureF = ds18b20.getTempFByIndex(0);

  airTemperatureF = dht.readTemperature(true);
  airHumidity = dht.readHumidity();

  long sum = 0; int mn = 4095, mx = 0;
  for (int i = 0; i < 10; i++) {
    int r = analogRead(SOIL_PIN);
    sum += r; if (r < mn) mn = r; if (r > mx) mx = r;
    delay(10);
  }
  soilRaw = sum / 10;
  // A real powered probe gives steady readings; an unplugged/floating pin is
  // noisy (large spread) and also drifts low. Treat either as disconnected so
  // the app shows "not connected" instead of a fake number.
  if ((mx - mn) > 600 || soilRaw < 300) soilRaw = 0;
  // raw 0 means disconnected; report 0% (not the 100% that map() would give for 0).
  soilMoisturePercent = (soilRaw == 0) ? 0 : constrain(map(soilRaw, dryValue, wetValue, 0, 100), 0, 100);

  batteryPct = readBatteryPercent();
}

// ============================================================
// Send to Losant
// ============================================================
void sendTelemetry() {
  StaticJsonDocument<256> doc;
  JsonObject root = doc.to<JsonObject>();
  root["soilTemperatureF"] = soilTemperatureF;
  root["airTemperatureF"] = airTemperatureF;
  root["airHumidity"] = airHumidity;
  root["soilRaw"] = soilRaw;
  root["soilMoisturePercent"] = soilMoisturePercent;
  // Report the live link so the app can show how this node is ACTUALLY
  // connected (Wi-Fi + signal), not a label the user picked. A LoRaWAN build
  // would omit this, letting the app fall back to showing LoRaWAN.
  root["wifiRssi"] = WiFi.RSSI();
  root["batteryPct"] = batteryPct;   // app shows the battery badge from this
  root["charging"] = charging;       // voltage-inferred charging state (no charge pin on the V3)
  device->sendState(root);

  Serial.print("Sent  moisture=");
  Serial.print(soilMoisturePercent);
  Serial.print("%  raw=");
  Serial.print(soilRaw);
  Serial.print("  airTemp=");
  Serial.print(airTemperatureF);
  Serial.println("F");
}

// ============================================================
// Power off: deep sleep until the PRG button (or RESET) wakes it.
// ============================================================
void enterDeepSleep() {
  Serial.println("Double-tap PRG: entering deep sleep. Press PRG or RESET to wake.");
  oledMessage("Sleeping", "tap PRG to wake");
  delay(1000);
  oled.setPowerSave(1);                  // OLED off
  digitalWrite(VEXT_PIN, HIGH);          // cut the Vext rail (OLED/sensors). HIGH = off on the V3.
  // Wake when PRG (GPIO0) is pulled LOW by a button press. ext1 ANY_LOW is the
  // portable RTC-GPIO wake on the S3 (GPIO0 is RTC-capable, with an external pull-up).
  esp_sleep_enable_ext1_wakeup(1ULL << RESET_BTN, ESP_EXT1_WAKEUP_ANY_LOW);
  delay(50);
  esp_deep_sleep_start();                // chip halts here; a wake reboots into setup()
}

// ============================================================
// PRG button:  single tap -> wake screen   |   double tap -> power off
//              hold 3s     -> wipe Wi-Fi and reopen setup
// ============================================================
void handleButton() {
  static bool wasDown = false;
  static unsigned long pressStart = 0;
  static unsigned long lastTapEnd = 0;
  static int tapCount = 0;
  bool down = (digitalRead(RESET_BTN) == LOW);

  if (down && !wasDown) {                       // press edge
    pressStart = millis();
    oledWake();                                 // any tap wakes the screen
  }
  if (down && pressStart && millis() - pressStart >= 3000) {   // long hold -> factory reset
    Serial.println("PRG held 3s: clearing saved Wi-Fi, reopening setup...");
    oledMessage("Clearing Wi-Fi", "reopening setup");
    delay(600);
    WiFiManager wm;
    wm.resetSettings();
    delay(400);
    ESP.restart();
  }
  if (!down && wasDown) {                        // release edge
    unsigned long held = millis() - pressStart;
    if (held < 700) {                           // a short tap (not a hold)
      tapCount = (millis() - lastTapEnd < 600) ? tapCount + 1 : 1;
      lastTapEnd = millis();
      if (tapCount >= 2) {                       // two quick taps -> power off
        tapCount = 0;
        enterDeepSleep();
      }
    } else {
      tapCount = 0;                             // a longer press isn't part of a double-tap
    }
  }
  wasDown = down;
}

// ============================================================
// Main loop
// ============================================================
void loop() {
  esp_task_wdt_reset();   // feed the watchdog every healthy cycle

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!device->connected()) {
    Serial.println("Reconnecting to Losant...");
    connectLosant();
  }

  readSensors();
  sendTelemetry();
  device->loop();

  bool online = WiFi.status() == WL_CONNECTED && device->connected();
  oledShowPage(screenPage, online);   // redraw current page with fresh values

  // Wait ~3s between sends, but keep watching PRG so a 3s hold resets Wi-Fi,
  // manage the screen dimmer, and cycle the status screen every ~5s so the
  // customer can see the pairing code, the connection, and live readings.
  unsigned long waitStart = millis();
  while (millis() - waitStart < 3000) {
    handleButton();
    updateScreenPower();
    if (millis() - lastPageSwitch >= PAGE_MS) {
      lastPageSwitch = millis();
      screenPage = (screenPage + 1) % PAGE_COUNT;
      oledShowPage(screenPage, WiFi.status() == WL_CONNECTED && device->connected());
    }
    delay(20);
  }
}