/* ============================================================
   GrowthPulse Node Firmware  v4.0  (COMBINED Wi-Fi + LoRaWAN)
   ------------------------------------------------------------
   Board: Heltec WiFi LoRa 32 V3 (ESP32-S3 + Semtech SX1262)

   ONE image, both network stacks. A saved "mode" flag in flash
   (NVS) decides the boot path:

     mode = "wifi"  (default)
        -> try saved Wi-Fi; if it can't connect (or none saved),
           open the phone setup hotspot. Self-provisions its own
           Losant identity over HTTPS. Streams to Losant via MQTT.

     mode = "lorawan"
        -> brings up the SX1262 and joins any LoRaWAN gateway in
           range via OTAA. Keys (DevEUI / JoinEUI / AppKey) are
           read from NVS (so the image stays identical and has NO
           per-board secrets). Uplinks a 9-byte payload that the
           TTS payload formatter decodes into the same fields.

   Switching modes:
     - In the setup hotspot portal (a "Connection" field).
     - From the app: a Losant "setMode" command (Wi-Fi units).
     - On a LoRaWAN unit, a downlink on fPort 11 sets the mode.
     Setting the mode writes NVS and reboots into the new path.

   *** NO per-board secrets live in this file. ***
   Wi-Fi units self-provision; LoRaWAN keys come from NVS. The
   PROVISION_TOKEN below is the shared firmware token (replace the
   placeholder with the real value only in a private build, never
   commit the real one).

   Libraries: WiFiManager (tzapu), OneWire, DallasTemperature,
     DHT sensor library, Losant Arduino MQTT, ArduinoJson, U8g2,
     RadioLib (jgromes).

   NOTE: this merges two network stacks, so the combined image is
   larger. If it overflows the default app partition, set
   Tools -> Partition Scheme to a larger-app / "Huge App" layout.
   This is a reference build; compile + flash once on the bench to
   confirm before relying on it.
   ============================================================ */

#include <WiFi.h>
#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <Losant.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <esp_task_wdt.h>
#include <esp_sleep.h>
#include <RadioLib.h>            // SX1262 LoRaWAN stack

// ----------------- Sensor + button pins -----------------
#define ONE_WIRE_BUS 4
#define DHTPIN 5
#define DHTTYPE DHT22
#define SOIL_PIN 2
#define RESET_BTN 0               // PRG button (GPIO0)

// ----------------- SX1262 radio pins (Heltec V3) -----------------
// These are the make-or-break numbers from the V3 schematic.
#define SX_NSS   8
#define SX_DIO1  14
#define SX_RST   12
#define SX_BUSY  13
#define SX_SCK   9
#define SX_MISO  11
#define SX_MOSI  10

#define FW_VERSION "4.0"
#define WDT_TIMEOUT_S 60
#define DIM_AFTER_MS (5UL * 60UL * 1000UL)
#define SELFTEST_HOLD_MS 10000

// LoRaWAN region: US915 sub-band 2 (FSB2) must match the gateway + TTS.
#define LORA_SUBBAND 2
#define UPLINK_FPORT 2
#define CMD_FPORT_SETMODE 11      // a downlink on this fPort flips the mode
// 15 minutes is the production interval (TTN fair-use = 30s airtime/day).
#define LORA_UPLINK_MS (15UL * 60UL * 1000UL)

#define PAGE_MS 5000
#define PAGE_COUNT 3

// ----------------- Battery (Heltec V3) -----------------
#define VBAT_CTRL 37
#define VBAT_ADC  1
static const float BAT_MIN_V = 3.04, BAT_MAX_V = 4.26;
#define USE_VBUS_SENSE 0          // set to 1 only on boards with the 5V->GPIO7 divider
#define VBUS_ADC 7
static const uint8_t BAT_CURVE[100] = {
  254,242,230,227,223,219,215,213,210,207, 206,202,202,200,200,199,198,198,196,196,
  195,195,194,192,191,188,187,185,185,185, 183,182,180,179,178,175,175,174,172,171,
  170,169,168,166,166,165,165,164,161,161, 159,158,158,157,156,155,151,148,147,145,
  143,142,140,140,136,132,130,130,129,126, 125,124,121,120,118,116,115,114,112,112,
  110,110,108,106,106,104,102,101, 99, 97,  94, 90, 81, 80, 76, 73, 66, 52, 32,  7,
};
int batteryPct = -1;
bool charging = false;
float battVSmooth = -1;

// ----------------- On-board OLED (Heltec V3) -----------------
#define VEXT_PIN 36
#define OLED_SDA 17
#define OLED_SCL 18
#define OLED_RST 21
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, OLED_RST, OLED_SCL, OLED_SDA);
void oledMessage(const char* l1, const char* l2);   // forward decl (used before its definition below)

// ----------------- Soil calibration -----------------
int dryValue = 3600;
int wetValue = 1300;

// ----------------- Self-provisioning (Wi-Fi mode) -----------------
#define PROVISION_URL   "https://growthpulsecloud.com/.netlify/functions/provision-device"
#define PROVISION_TOKEN "REPLACE-WITH-SHARED-FIRMWARE-TOKEN"   // == Netlify env PROVISION_TOKEN

String losantDeviceId, losantAccessKey, losantAccessSecret;
Preferences nvs;

// ----------------- Network mode -----------------
// "wifi" (default) or "lorawan", read from NVS at boot.
String netMode = "wifi";
const char* linkLabel = "Wi-Fi";   // what the OLED prints; flips to "LoRaWAN"

// LoRa link signal (filled after each uplink), shown on the OLED + reported.
int   loraRssi = 0;
float loraSnr  = 0;
bool  loraJoined = false;

// ----------------- LoRaWAN objects + OTAA keys (from NVS) -----------------
SX1262 radio = new Module(SX_NSS, SX_DIO1, SX_RST, SX_BUSY);
const LoRaWANBand_t Region = US915;
LoRaWANNode loraNode(&radio, &Region, LORA_SUBBAND);
uint64_t lwJoinEUI = 0x0000000000000000;
uint64_t lwDevEUI  = 0;
uint8_t  lwAppKey[16] = {0};
uint8_t  lwNwkKey[16] = {0};      // == AppKey for LoRaWAN 1.0.x
bool     lwKeysLoaded = false;

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
<div class="welcome">Welcome! Choose your Wi-Fi below. To use a LoRaWAN gateway instead, type "lorawan" in the Connection box.</div>
</div>
)GPHTML";

// ----------------- Objects -----------------
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);
DHT dht(DHTPIN, DHTTYPE);

WiFiClient wifiClient;
LosantDevice* device = nullptr;

// ----------------- Sensor values -----------------
float soilTemperatureF = 0.0;
float airTemperatureF = 0.0;
float airHumidity = 0.0;
int soilRaw = 0;
int soilMoisturePercent = 0;

// Screen state.
unsigned long lastInteraction = 0;
bool oledDimmed = false;
int screenPage = 0;
unsigned long lastPageSwitch = 0;

Preferences loraStore;   // separate NVS namespace for LoRaWAN nonces

// ============================================================
// Identity helpers
// ============================================================
uint32_t chipUid() { return (uint32_t)((ESP.getEfuseMac() >> 24) & 0xFFFFFF); }
String pairCode() { char b[8]; snprintf(b, sizeof(b), "%06X", chipUid()); return String(b); }
String apSsid()  { char b[24]; snprintf(b, sizeof(b), "GrowthPulse-%06X", chipUid()); return String(b); }

// ============================================================
// Network mode (NVS)
// ============================================================
String getMode() {
  nvs.begin("gp", true);
  String m = nvs.getString("netmode", "wifi");
  nvs.end();
  return (m == "lorawan") ? "lorawan" : "wifi";
}
void setModeAndReboot(const String& m) {
  nvs.begin("gp", false);
  nvs.putString("netmode", (m == "lorawan") ? "lorawan" : "wifi");
  nvs.end();
  oledMessage("Switching to", (m == "lorawan") ? "LoRaWAN..." : "Wi-Fi...");
  delay(800);
  ESP.restart();
}

// Load the OTAA keys from NVS. Returns false if they were never written (a
// LoRaWAN unit must be provisioned with keys once before this works).
bool loadLoRaKeys() {
  nvs.begin("gp", true);
  size_t dl = nvs.getBytesLength("lwDevEUI");
  size_t al = nvs.getBytesLength("lwAppKey");
  size_t jl = nvs.getBytesLength("lwJoinEUI");
  if (dl == sizeof(lwDevEUI) && al == sizeof(lwAppKey)) {
    nvs.getBytes("lwDevEUI", &lwDevEUI, sizeof(lwDevEUI));
    nvs.getBytes("lwAppKey", lwAppKey, sizeof(lwAppKey));
    if (jl == sizeof(lwJoinEUI)) nvs.getBytes("lwJoinEUI", &lwJoinEUI, sizeof(lwJoinEUI));
    memcpy(lwNwkKey, lwAppKey, sizeof(lwNwkKey));   // 1.0.x: nwkKey = appKey
    lwKeysLoaded = true;
  }
  nvs.end();
  return lwKeysLoaded;
}

// Helper a provisioning tool / serial command can call to store the keys.
void saveLoRaKeys(uint64_t joinEUI, uint64_t devEUI, const uint8_t appKey[16]) {
  nvs.begin("gp", false);
  nvs.putBytes("lwJoinEUI", &joinEUI, sizeof(joinEUI));
  nvs.putBytes("lwDevEUI", &devEUI, sizeof(devEUI));
  nvs.putBytes("lwAppKey", appKey, 16);
  nvs.end();
}

// Parse a hex string ("0A1B...") into `n` bytes. Used by the provisionLoRa
// command to unpack the AppKey the backend pushes down.
void hexToBytes(const char* hexStr, uint8_t* out, size_t n) {
  for (size_t i = 0; i < n; i++) {
    char b[3] = { hexStr[i * 2], hexStr[i * 2 + 1], 0 };
    out[i] = (uint8_t)strtoul(b, nullptr, 16);
  }
}

// ============================================================
// Battery / power
// ============================================================
bool usbPlugged() {
#if USE_VBUS_SENSE
  return analogReadMilliVolts(VBUS_ADC) > 1000;
#else
  return false;
#endif
}

int readBatteryPercent() {
  pinMode(VBAT_CTRL, OUTPUT);
  digitalWrite(VBAT_CTRL, HIGH);
  delay(100);
  long acc = 0;
  for (int i = 0; i < 16; i++) { acc += analogRead(VBAT_ADC); delay(2); }
  pinMode(VBAT_CTRL, INPUT);
  float raw = acc / 16.0f;
  float v = raw / 238.7f;
  if (v < 2.5f) { charging = false; return -1; }
  if (battVSmooth < 0) battVSmooth = v;
  float dv = v - battVSmooth;
  battVSmooth += 0.20f * (v - battVSmooth);
#if USE_VBUS_SENSE
  bool plugged = usbPlugged();
  if (!plugged)                         charging = false;
  else if (v >= 4.18f && dv < 0.004f) { charging = false; return -1; }
  else                                  charging = true;
#else
  if      (dv >  0.006f)  charging = true;
  else if (v  >= 4.18f)   charging = true;
  else if (dv < -0.006f)  charging = false;
  if (v >= 4.22f && dv < 0.004f) { charging = false; return -1; }
#endif
  int rawPct = 0;
  float step = (BAT_MAX_V - BAT_MIN_V) / 256.0f;
  for (int n = 0; n < 100; n++) if (v > BAT_MIN_V + step * BAT_CURVE[n]) { rawPct = 100 - n; break; }
  static int displayedPct = -1;
  if (displayedPct < 0)  displayedPct = rawPct;
  else if (charging)   { if (rawPct > displayedPct) displayedPct++; }
  else                 { if (rawPct > displayedPct) displayedPct++; else if (rawPct < displayedPct) displayedPct--; }
  return displayedPct;
}

// ============================================================
// OLED
// ============================================================
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

void drawRight(int x, int y, const char* s) { oled.drawStr(x - oled.getStrWidth(s), y, s); }

void pageHeader(const char* title, bool online) {
  oled.setFont(u8g2_font_6x12_tr);
  oled.drawStr(2, 11, title);
  oled.setFont(u8g2_font_6x10_tr);
  char lk[16]; snprintf(lk, sizeof(lk), online ? "%s" : "%s --", linkLabel);
  drawRight(126, 10, lk);
  oled.drawHLine(0, 14, 128);
}

void pagePairCode(bool online) {
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(2, 9, "PAIR CODE");
  char lk[16]; snprintf(lk, sizeof(lk), online ? "%s ON" : "%s ..", linkLabel);
  drawRight(126, 9, lk);
  drawBigCentered(pairCode().c_str(), 56);
  oled.sendBuffer();
}

// Connection page: shows Wi-Fi signal OR LoRaWAN RSSI/SNR, plus battery.
void pageConnection(bool online) {
  oled.clearBuffer();
  pageHeader("CONNECTION", online);
  oled.setFont(u8g2_font_6x10_tr);
  char val[24];
  oled.drawStr(2, 28, "Link");
  drawRight(126, 28, linkLabel);

  if (netMode == "lorawan") {
    if (loraJoined) {
      snprintf(val, sizeof(val), "%d dBm", loraRssi);
      oled.drawStr(2, 41, "RSSI");
      drawRight(126, 41, val);
    } else {
      oled.drawStr(2, 41, "Joining...");
    }
  } else {
    if (online) {
      snprintf(val, sizeof(val), "%ld dBm", (long)WiFi.RSSI());
      oled.drawStr(2, 41, "Signal");
      drawRight(126, 41, val);
    } else {
      oled.drawStr(2, 41, "Connecting...");
    }
  }

  oled.drawStr(2, 54, charging ? "Charging" : "Battery");
  if (batteryPct >= 0) snprintf(val, sizeof(val), charging ? "%d%% +" : "%d%%", batteryPct);
  else snprintf(val, sizeof(val), "AC/USB");
  drawRight(126, 54, val);
  oled.sendBuffer();
}

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

void oledShowPage(int page, bool online) {
  switch (page) {
    case 1:  pageConnection(online); break;
    case 2:  pageReadings();         break;
    default: pagePairCode(online);   break;
  }
}

void oledWake() {
  lastInteraction = millis();
  if (oledDimmed) { oled.setContrast(255); oledDimmed = false; }
}
void updateScreenPower() {
  if (millis() - lastInteraction > DIM_AFTER_MS && !oledDimmed) { oled.setContrast(20); oledDimmed = true; }
}

void bootSelfTest() {
  ds18b20.requestTemperatures();
  bool soilT = ds18b20.getTempCByIndex(0) > -100;
  float at = dht.readTemperature();
  if (isnan(at)) { delay(2200); at = dht.readTemperature(); }
  bool air = !isnan(at);
  long rsum = 0; int rmn = 4095, rmx = 0;
  for (int i = 0; i < 8; i++) { int r = analogRead(SOIL_PIN); rsum += r; if (r < rmn) rmn = r; if (r > rmx) rmx = r; delay(5); }
  int raw = rsum / 8;
  bool moist = (raw > 300) && ((rmx - rmn) < 600);
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x12_tr);
  oled.drawStr(2, 11, "Self-test   v" FW_VERSION);
  oled.drawHLine(0, 14, 128);
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(2, 28, soilT ? "Soil temp      OK" : "Soil temp      --");
  oled.drawStr(2, 41, air   ? "Air sensor     OK" : "Air sensor     --");
  oled.drawStr(2, 54, moist ? "Moisture       OK" : "Moisture       --");
  oled.sendBuffer();
  delay(SELFTEST_HOLD_MS);
}

void onSetupPortal(WiFiManager* mgr) { oledWake(); oledSetup(); }

// ============================================================
// Sensor reads (shared by both modes)
// ============================================================
void readSensors() {
  ds18b20.requestTemperatures();
  soilTemperatureF = ds18b20.getTempFByIndex(0);
  airTemperatureF = dht.readTemperature(true);
  airHumidity = dht.readHumidity();
  long sum = 0; int mn = 4095, mx = 0;
  for (int i = 0; i < 10; i++) { int r = analogRead(SOIL_PIN); sum += r; if (r < mn) mn = r; if (r > mx) mx = r; delay(10); }
  soilRaw = sum / 10;
  if ((mx - mn) > 600 || soilRaw < 300) soilRaw = 0;
  soilMoisturePercent = (soilRaw == 0) ? 0 : constrain(map(soilRaw, dryValue, wetValue, 0, 100), 0, 100);
  batteryPct = readBatteryPercent();
}

// ============================================================
// ============   Wi-Fi mode   ================================
// ============================================================
void connectWiFi() {
  WiFiManager wm;
  wm.setWiFiAutoReconnect(false);
  WiFi.setSleep(false);
  wm.setConnectTimeout(15);
  wm.setCustomHeadElement(GP_HEAD);
  WiFiManagerParameter gpBranding(GP_BRANDING);
  // A "Connection" field: leave as Wi-Fi, or type lorawan to switch this unit.
  WiFiManagerParameter connParam("conn", "Connection (wifi / lorawan)", "wifi", 10);
  wm.addParameter(&gpBranding);
  wm.addParameter(&connParam);
  wm.setAPCallback(onSetupPortal);
  wm.setConfigPortalTimeout(600);

  String ap = apSsid();
  oledMessage("Connecting to", "your Wi-Fi...");
  esp_task_wdt_delete(NULL);
  bool ok = wm.autoConnect(ap.c_str());
  esp_task_wdt_add(NULL);

  // If the user asked for LoRaWAN in the portal, flip the mode and reboot.
  String chosen = connParam.getValue();
  chosen.toLowerCase();
  if (chosen.indexOf("lora") >= 0) setModeAndReboot("lorawan");

  if (!ok) { oledMessage("Setup timed out", "restarting..."); delay(1500); ESP.restart(); }
  Serial.print("Wi-Fi IP: "); Serial.println(WiFi.localIP());
  screenPage = 0; lastPageSwitch = millis();
  pagePairCode(false);
}

void handleCommand(LosantCommand *command) {
  Serial.print("Cloud command: "); Serial.println(command->name);
  if (strcmp(command->name, "factoryReset") == 0) {
    oledMessage("Reset by owner", "clearing Wi-Fi...");
    delay(800);
    WiFiManager wm; wm.resetSettings();
    delay(400); ESP.restart();
  } else if (strcmp(command->name, "setMode") == 0) {
    // Payload { "mode": "lorawan" | "wifi" } (payload is a JsonObject*)
    const char* m = (*command->payload)["mode"].as<const char*>();
    if (m) setModeAndReboot(String(m));
  } else if (strcmp(command->name, "provisionLoRa") == 0) {
    // The backend auto-provisioned a TTS device and pushed its OTAA keys here:
    //   { joinEUI: "16hex", devEUI: "16hex", appKey: "32hex" }
    // Save them to flash and reboot into LoRaWAN, where they're loaded from NVS.
    JsonObject p = *command->payload;
    const char* je = p["joinEUI"].as<const char*>();
    const char* de = p["devEUI"].as<const char*>();
    const char* ak = p["appKey"].as<const char*>();
    if (de && ak && strlen(de) == 16 && strlen(ak) == 32) {
      uint64_t joinEUI = je ? strtoull(je, nullptr, 16) : 0ULL;
      uint64_t devEUI  = strtoull(de, nullptr, 16);
      uint8_t appKey[16];
      hexToBytes(ak, appKey, 16);
      saveLoRaKeys(joinEUI, devEUI, appKey);
      oledMessage("LoRaWAN keys set", "switching over...");
      delay(900);
      setModeAndReboot("lorawan");
    } else {
      Serial.println("provisionLoRa: bad/short keys, ignoring.");
    }
  }
}

bool provisionFromBackend() {
  oledMessage("First-time setup", "registering device");
  WiFiClientSecure tls; tls.setInsecure();
  HTTPClient http;
  if (!http.begin(tls, PROVISION_URL)) return false;
  http.addHeader("Content-Type", "application/json");
  StaticJsonDocument<192> req;
  req["code"] = pairCode();
  req["token"] = PROVISION_TOKEN;
  String reqBody; serializeJson(req, reqBody);
  int code = http.POST(reqBody);
  if (code != 200) { http.end(); return false; }
  String resp = http.getString(); http.end();
  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, resp)) return false;
  losantDeviceId     = (const char*)(doc["deviceId"]     | "");
  losantAccessKey    = (const char*)(doc["accessKey"]    | "");
  losantAccessSecret = (const char*)(doc["accessSecret"] | "");
  if (losantDeviceId == "" || losantAccessKey == "" || losantAccessSecret == "") return false;
  nvs.begin("gp", false);
  nvs.putString("ldid", losantDeviceId);
  nvs.putString("lkey", losantAccessKey);
  nvs.putString("lsec", losantAccessSecret);
  nvs.end();
  return true;
}

void ensureProvisioned() {
  nvs.begin("gp", true);
  losantDeviceId     = nvs.getString("ldid", "");
  losantAccessKey    = nvs.getString("lkey", "");
  losantAccessSecret = nvs.getString("lsec", "");
  nvs.end();
  if (losantDeviceId == "" || losantAccessKey == "" || losantAccessSecret == "") {
    while (!provisionFromBackend()) {
      esp_task_wdt_reset();
      oledMessage("Setup retry", "check internet");
      delay(5000);
    }
  }
  device = new LosantDevice(losantDeviceId.c_str());
  device->onCommand(&handleCommand);
}

void connectLosant() {
  oledMessage("Connecting to", "GrowthPulse cloud");
  device->connect(wifiClient, losantAccessKey.c_str(), losantAccessSecret.c_str());
  while (!device->connected()) { esp_task_wdt_reset(); delay(500); }
}

void sendTelemetryWiFi() {
  StaticJsonDocument<256> doc;
  JsonObject root = doc.to<JsonObject>();
  root["soilTemperatureF"] = soilTemperatureF;
  root["airTemperatureF"] = airTemperatureF;
  root["airHumidity"] = airHumidity;
  root["soilRaw"] = soilRaw;
  root["soilMoisturePercent"] = soilMoisturePercent;
  root["wifiRssi"] = WiFi.RSSI();
  root["batteryPct"] = batteryPct;
  root["charging"] = charging;
  device->sendState(root);
}

// ============================================================
// ============   LoRaWAN mode   ==============================
// ============================================================
void lwSaveNonces() {
  loraStore.begin("lorawan", false);
  loraStore.putBytes("nonces", loraNode.getBufferNonces(), RADIOLIB_LORAWAN_NONCES_BUF_SIZE);
  loraStore.end();
}
void lwRestoreNonces() {
  loraStore.begin("lorawan", true);
  if (loraStore.isKey("nonces")) {
    uint8_t buf[RADIOLIB_LORAWAN_NONCES_BUF_SIZE];
    loraStore.getBytes("nonces", buf, RADIOLIB_LORAWAN_NONCES_BUF_SIZE);
    loraNode.setBufferNonces(buf);
  }
  loraStore.end();
}

// Bring up the SX1262 and join via OTAA. Returns true once joined.
bool lwJoin() {
  // The V3 needs a non-zero TCXO voltage (RadioLib default 1.6V) and DIO2 as the
  // antenna RF switch; radio.begin() applies the TCXO, then we set the switch.
  SPI.begin(SX_SCK, SX_MISO, SX_MOSI, SX_NSS);
  int16_t st = radio.begin();
  if (st != RADIOLIB_ERR_NONE) {
    Serial.printf("radio.begin() failed: %d (TCXO/pins, Bring-Up Guide §9)\n", st);
    oledMessage("Radio error", "check antenna");
    return false;
  }
  radio.setDio2AsRfSwitch(true);
  lwRestoreNonces();

  oledMessage("LoRaWAN", "joining gateway...");
  Serial.println("LoRaWAN: OTAA join (US915 FSB2)...");
  st = loraNode.beginOTAA(lwJoinEUI, lwDevEUI, lwNwkKey, lwAppKey);
  // beginOTAA blocks through the join; >= 0 (RADIOLIB_LORAWAN_NEW_SESSION) = joined.
  if (st < RADIOLIB_ERR_NONE) {
    Serial.printf("Join failed: %d\n", st);
    return false;
  }
  lwSaveNonces();
  loraJoined = true;
  Serial.println("LoRaWAN: JOINED.");
  return true;
}

// Pack the 9-byte payload the TTS formatter decodes, send it, capture the link
// signal, and dispatch any downlink (e.g. a mode switch on fPort 11).
void lwSendReading() {
  int16_t soilT10 = (soilTemperatureF > -100) ? (int16_t)lround(soilTemperatureF * 10) : (int16_t)0x8000;
  int16_t airT10  = (!isnan(airTemperatureF)) ? (int16_t)lround(airTemperatureF * 10) : 0;
  uint8_t hum     = (!isnan(airHumidity) && airHumidity > 0) ? (uint8_t)constrain((int)lround(airHumidity), 0, 100) : 0;
  uint16_t raw    = (uint16_t)constrain(soilRaw, 0, 4095);
  uint8_t moist   = (uint8_t)constrain(soilMoisturePercent, 0, 100);
  uint8_t flags   = (batteryPct >= 0 ? (uint8_t)constrain(batteryPct, 0, 100) : 0xFF);

  uint8_t payload[9] = {
    (uint8_t)(soilT10 >> 8), (uint8_t)(soilT10 & 0xFF),
    (uint8_t)(airT10  >> 8), (uint8_t)(airT10  & 0xFF),
    hum,
    (uint8_t)(raw >> 8), (uint8_t)(raw & 0xFF),
    moist,
    flags,
  };

  uint8_t dlBuf[16]; size_t dlLen = sizeof(dlBuf);
  int16_t rxState = loraNode.sendReceive(payload, sizeof(payload), UPLINK_FPORT, dlBuf, &dlLen);
  if (rxState < RADIOLIB_ERR_NONE) {
    Serial.printf("Uplink error: %d\n", rxState);
    return;
  }
  loraRssi = (int)radio.getRSSI();
  loraSnr  = radio.getSNR();
  Serial.printf("Uplink sent. RSSI=%d SNR=%.1f%s\n", loraRssi, loraSnr, rxState > 0 ? "  (downlink)" : "");

  // Downlink handling: a 1-byte command switches the mode (0x00 = Wi-Fi).
  // Send it from the app/TTS on fPort 11 with payload 00 to pull a unit back to
  // Wi-Fi. (Reading the exact downlink fPort varies by RadioLib version, so we
  // keep it simple: a single 0x00 byte = switch to Wi-Fi and reboot.)
  if (rxState > 0 && dlLen == 1 && dlBuf[0] == 0x00) {
    setModeAndReboot("wifi");
  }
}

// ============================================================
// Power off (deep sleep) + PRG button  (shared)
// ============================================================
void enterDeepSleep() {
  oledMessage("Sleeping", "tap PRG to wake");
  delay(1000);
  oled.setPowerSave(1);
  digitalWrite(VEXT_PIN, HIGH);
  esp_sleep_enable_ext1_wakeup(1ULL << RESET_BTN, ESP_EXT1_WAKEUP_ANY_LOW);
  delay(50);
  esp_deep_sleep_start();
}

void handleButton() {
  static bool wasDown = false;
  static unsigned long pressStart = 0, lastTapEnd = 0;
  static int tapCount = 0;
  bool down = (digitalRead(RESET_BTN) == LOW);
  if (down && !wasDown) { pressStart = millis(); oledWake(); }
  if (down && pressStart && millis() - pressStart >= 3000) {
    // Hold 3s: Wi-Fi units wipe Wi-Fi + reopen setup; either mode also resets to
    // Wi-Fi mode so a stuck LoRaWAN unit can always be recovered by the owner.
    oledMessage("Resetting", "to Wi-Fi setup");
    delay(600);
    WiFiManager wm; wm.resetSettings();
    nvs.begin("gp", false); nvs.putString("netmode", "wifi"); nvs.end();
    delay(400); ESP.restart();
  }
  if (!down && wasDown) {
    unsigned long held = millis() - pressStart;
    if (held < 700) {
      tapCount = (millis() - lastTapEnd < 600) ? tapCount + 1 : 1;
      lastTapEnd = millis();
      if (tapCount >= 2) { tapCount = 0; enterDeepSleep(); }
    } else tapCount = 0;
  }
  wasDown = down;
}

// ============================================================
// Setup
// ============================================================
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  pinMode(RESET_BTN, INPUT_PULLUP);
  delay(1000);

  bool wokeFromSleep = (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT1);

  oledInit();
  oledMessage(wokeFromSleep ? "Waking up" : "Starting up", "GrowthPulse");

  if (!wokeFromSleep && digitalRead(RESET_BTN) == LOW) {
    oledMessage("Clearing Wi-Fi", "reopening setup");
    WiFiManager wmReset; wmReset.resetSettings();
    nvs.begin("gp", false); nvs.putString("netmode", "wifi"); nvs.end();
    delay(800);
  }

  ds18b20.begin();
  dht.begin();
  lastInteraction = millis();
  bootSelfTest();

#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t wdtCfg = { .timeout_ms = WDT_TIMEOUT_S * 1000, .idle_core_mask = 0, .trigger_panic = true };
  esp_task_wdt_reconfigure(&wdtCfg);
#else
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
  esp_task_wdt_add(NULL);

  // ---- choose the network path ----
  netMode = getMode();
  if (netMode == "lorawan") {
    linkLabel = "LoRaWAN";
    if (!loadLoRaKeys()) {
      // No keys provisioned: a LoRaWAN unit can't join. Fall back to Wi-Fi setup
      // so the unit is never bricked, and let the owner reconfigure.
      Serial.println("LoRaWAN mode but no keys in NVS; falling back to Wi-Fi.");
      oledMessage("LoRaWAN keys", "missing -> Wi-Fi");
      delay(1500);
      netMode = "wifi";
      linkLabel = "Wi-Fi";
    }
  }

  if (netMode == "lorawan") {
    Serial.println("=== GrowthPulse (LoRaWAN mode) ===");
    while (!lwJoin()) {
      esp_task_wdt_reset();
      Serial.println("Join failed; retry in 30s. Press PRG-hold 3s to recover to Wi-Fi.");
      // keep the button responsive during the wait
      unsigned long w = millis();
      while (millis() - w < 30000) { handleButton(); delay(20); esp_task_wdt_reset(); }
    }
  } else {
    Serial.println("=== GrowthPulse (Wi-Fi mode) ===");
    connectWiFi();
    ensureProvisioned();
    connectLosant();
  }
}

// ============================================================
// Loop
// ============================================================
void loopWiFi() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!device->connected()) connectLosant();
  readSensors();
  sendTelemetryWiFi();
  device->loop();
  bool online = WiFi.status() == WL_CONNECTED && device->connected();
  oledShowPage(screenPage, online);
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

void loopLoRaWAN() {
  readSensors();
  lwSendReading();
  // Idle until the next uplink window (15 min) while keeping the screen + button
  // alive. LoRaWAN is duty-cycle limited; do NOT shorten this in production.
  unsigned long waitStart = millis();
  oledShowPage(screenPage, loraJoined);
  while (millis() - waitStart < LORA_UPLINK_MS) {
    esp_task_wdt_reset();
    handleButton();
    updateScreenPower();
    if (millis() - lastPageSwitch >= PAGE_MS) {
      lastPageSwitch = millis();
      screenPage = (screenPage + 1) % PAGE_COUNT;
      oledShowPage(screenPage, loraJoined);
    }
    delay(20);
  }
}

void loop() {
  esp_task_wdt_reset();
  if (netMode == "lorawan") loopLoRaWAN();
  else                      loopWiFi();
}
