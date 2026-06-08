/* ============================================================
   GrowthPulse Provisioning Firmware
   ------------------------------------------------------------
   Board: Heltec WiFi LoRa 32 V3 (ESP32-S3)
   Wiring: DS18B20 -> GPIO4, DHT22 -> GPIO5, Soil AO -> GPIO2 (5V)
   Libraries: WiFiManager (tzapu), OneWire, DallasTemperature,
     DHT sensor library, Losant Arduino MQTT, ArduinoJson, U8g2

   Reset Wi-Fi any time: hold PRG for 3 seconds (no RST needed),
   hold PRG while powering on, OR factory-reset from the app.
   ============================================================ */

#include <WiFi.h>
#include <WiFiManager.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <Losant.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <esp_task_wdt.h>        // hardware watchdog: auto-reboot on a hang

// ----------------- Pins -----------------
#define ONE_WIRE_BUS 4
#define DHTPIN 5
#define DHTTYPE DHT22
#define SOIL_PIN 2                // Soil on GPIO2 (GPIO1 is tied to battery-sense)
#define RESET_BTN 0               // PRG button (GPIO0): hold 3s to redo Wi-Fi setup

#define FW_VERSION "2.3"          // shown on the boot self-test screen (see CHANGELOG.md)
#define WDT_TIMEOUT_S 60          // reboot if the firmware hangs this long
#define DIM_AFTER_MS (5UL * 60UL * 1000UL)  // dim the OLED after 5 idle minutes
#define SELFTEST_HOLD_MS 10000    // hold the sensor self-test on screen this long to read it

// How this unit reaches the cloud, shown on screen so the customer can SEE it.
// This firmware build is Wi-Fi. A future LoRaWAN build flips LINK_LABEL to
// "LoRaWAN" (and replaces the Wi-Fi stack), so the screen always tells the truth.
#define LINK_LABEL "Wi-Fi"
#define PAGE_MS 5000              // cycle the status screen every ~5 seconds
#define PAGE_COUNT 3             // pair code -> connection -> live readings

// ----------------- On-board OLED (Heltec V3) -----------------
#define VEXT_PIN 36
#define OLED_SDA 17
#define OLED_SCL 18
#define OLED_RST 21
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, OLED_RST, OLED_SCL, OLED_SDA);

// ----------------- Soil calibration -----------------
int dryValue = 3600;
int wetValue = 1300;

// ----------------- Losant identity (this unit) -----------------
const char* LOSANT_DEVICE_ID    = "YOUR-LOSANT-DEVICE-ID";
const char* LOSANT_ACCESS_KEY   = "YOUR-LOSANT-ACCESS-KEY";
const char* LOSANT_ACCESS_SECRET= "YOUR-LOSANT-ACCESS-SECRET";

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
LosantDevice device(LOSANT_DEVICE_ID);

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
String pairCode() {
  char b[8];
  snprintf(b, sizeof(b), "%X", (uint32_t)((ESP.getEfuseMac() >> 24) & 0xFFFFFF));
  return String(b);
}

String apSsid() {
  char b[24];
  snprintf(b, sizeof(b), "GrowthPulse-%06X", (uint32_t)((ESP.getEfuseMac() >> 24) & 0xFFFFFF));
  return String(b);
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

// Page 1: how it's connected, what its signal is, and its address.
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
    oled.drawStr(2, 54, "IP");
    drawRight(126, 54, WiFi.localIP().toString().c_str());
  } else {
    oled.drawStr(2, 44, "Connecting...");
  }
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

  int raw = analogRead(SOIL_PIN);
  bool moist = raw > 300;                            // floating probe reads near 0

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
// Losant connection
// ============================================================
void connectLosant() {
  Serial.print("Connecting to Losant");
  oledMessage("Connecting to", "GrowthPulse cloud");
  device.connect(wifiClient, LOSANT_ACCESS_KEY, LOSANT_ACCESS_SECRET);
  while (!device.connected()) {
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

  oledInit();
  oledMessage("Starting up", "GrowthPulse");

  // Hold PRG while powering on to forget Wi-Fi and reopen setup.
  if (digitalRead(RESET_BTN) == LOW) {
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

  // Listen for commands from the app (remote factory reset).
  device.onCommand(&handleCommand);

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

  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(SOIL_PIN);
    delay(10);
  }
  soilRaw = sum / 10;
  soilMoisturePercent = map(soilRaw, dryValue, wetValue, 0, 100);
  soilMoisturePercent = constrain(soilMoisturePercent, 0, 100);
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
  device.sendState(root);

  Serial.print("Sent  moisture=");
  Serial.print(soilMoisturePercent);
  Serial.print("%  raw=");
  Serial.print(soilRaw);
  Serial.print("  airTemp=");
  Serial.print(airTemperatureF);
  Serial.println("F");
}

// ============================================================
// Hold PRG for 3 seconds (any time) to wipe Wi-Fi and reopen setup.
// ============================================================
void maybeResetWifi() {
  static unsigned long pressStart = 0;
  if (digitalRead(RESET_BTN) == LOW) {        // PRG button held down
    if (pressStart == 0) { pressStart = millis(); oledWake(); }  // any tap wakes the screen
    else if (millis() - pressStart >= 3000) {
      Serial.println("PRG held 3s: clearing saved Wi-Fi, reopening setup...");
      oledMessage("Clearing Wi-Fi", "reopening setup");
      delay(600);
      WiFiManager wm;
      wm.resetSettings();
      delay(400);
      ESP.restart();
    }
  } else {
    pressStart = 0;                           // released before 3s, reset timer
  }
}

// ============================================================
// Main loop
// ============================================================
void loop() {
  esp_task_wdt_reset();   // feed the watchdog every healthy cycle

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!device.connected()) {
    Serial.println("Reconnecting to Losant...");
    connectLosant();
  }

  readSensors();
  sendTelemetry();
  device.loop();

  bool online = WiFi.status() == WL_CONNECTED && device.connected();
  oledShowPage(screenPage, online);   // redraw current page with fresh values

  // Wait ~3s between sends, but keep watching PRG so a 3s hold resets Wi-Fi,
  // manage the screen dimmer, and cycle the status screen every ~5s so the
  // customer can see the pairing code, the connection, and live readings.
  unsigned long waitStart = millis();
  while (millis() - waitStart < 3000) {
    maybeResetWifi();
    updateScreenPower();
    if (millis() - lastPageSwitch >= PAGE_MS) {
      lastPageSwitch = millis();
      screenPage = (screenPage + 1) % PAGE_COUNT;
      oledShowPage(screenPage, WiFi.status() == WL_CONNECTED && device.connected());
    }
    delay(20);
  }
}