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

// ----------------- Pins -----------------
#define ONE_WIRE_BUS 4
#define DHTPIN 5
#define DHTTYPE DHT22
#define SOIL_PIN 2                // Soil on GPIO2 (GPIO1 is tied to battery-sense)
#define RESET_BTN 0               // PRG button (GPIO0): hold 3s to redo Wi-Fi setup

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
// PLACEHOLDERS: create your own device + access key at losant.com and
// paste the three values here before flashing. Never commit real values.
// Full setup walkthrough: docs/GrowthPulse Engineering Manual.pdf
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

// ============================================================
// On-board OLED helpers
// ============================================================
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

void oledStatus(bool online) {
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(2, 9, "PAIR CODE");
  oled.drawStr(108, 9, online ? "ON" : "..");
  drawBigCentered(pairCode().c_str(), 54);
  oled.sendBuffer();
}

void onSetupPortal(WiFiManager* mgr) {
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

  if (!wm.autoConnect(ap.c_str())) {
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
    if (pressStart == 0) pressStart = millis();
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
  oledStatus(WiFi.status() == WL_CONNECTED && device.connected());

  // Wait ~3s between sends, but keep watching PRG so a 3s hold resets Wi-Fi.
  unsigned long waitStart = millis();
  while (millis() - waitStart < 3000) {
    maybeResetWifi();
    delay(20);
  }
}