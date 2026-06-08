/* ============================================================
   GrowthPulse LoRaWAN node — BENCH BRING-UP sketch
   ------------------------------------------------------------
   Board: Heltec WiFi LoRa 32 V3 (ESP32-S3 + Semtech SX1262)
   Region: US915, sub-band 2 (FSB2) — must match the gateway + TTS.

   Purpose: prove the OTAA join to The Things Stack and send the
   same sensor payload the Wi-Fi node sends, packed into 9 bytes.
   Once this joins and uplinks reliably, merge it into the main
   firmware as a boot-selectable mode (see the Bring-Up Guide §8).

   Libraries (Arduino Library Manager):
     - RadioLib                      (jgromes)
     - Heltec ESP32 LoRa V3          (ropg)  -> heltec_unofficial.h
       (this gives the correct V3 pins + TCXO + RF-switch setup)
   Sensors (same wiring as GP_Provisioning):
     DS18B20 -> GPIO4 (4.7k pull-up to 3V3), DHT22 -> GPIO5,
     Soil AO -> GPIO2 (probe VCC = 5V)

   FILL IN your TTS keys below (Console: end device -> OTAA).
   ============================================================ */

#include <heltec_unofficial.h>   // provides `radio` (SX1262, correct V3 pins/TCXO), Serial helpers
#include <RadioLib.h>
#include <Preferences.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>

// ---------------- Sensors ----------------
#define ONE_WIRE_BUS 4
#define DHTPIN 5
#define DHTTYPE DHT22
#define SOIL_PIN 2
int dryValue = 3600, wetValue = 1300;   // same calibration as the Wi-Fi firmware

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);
DHT dht(DHTPIN, DHTTYPE);

// ---------------- LoRaWAN region ----------------
// US915 + sub-band 2 is MANDATORY for The Things Stack. subBand=0 hammers all
// 64 channels and joins very slowly / not at all.
const LoRaWANBand_t Region = US915;
const uint8_t subBand = 2;
LoRaWANNode node(&radio, &Region, subBand);

// ---------------- OTAA credentials (from the TTS console) ----------------
// JoinEUI/AppEUI: all-zeros is fine for a dev device (must match TTS).
uint64_t joinEUI = 0x0000000000000000;
// DevEUI: paste the value you generated in TTS (hex, MSB first).
uint64_t devEUI  = 0x0000000000000000;   // <-- FILL IN
// AppKey: 16 bytes from TTS. For LoRaWAN 1.0.x set nwkKey == appKey.
uint8_t appKey[16] = { 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0 };   // <-- FILL IN
uint8_t nwkKey[16] = { 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0 };   // <-- same as appKey for 1.0.x

// ---------------- Timing ----------------
// 15 minutes is the production interval (TTN fair-use = 30s airtime/day).
// Use a SHORT interval (e.g. 60s) only while bench-testing the join.
#define UPLINK_INTERVAL_MS (60UL * 1000UL)   // <-- 60s for testing; set to 15*60*1000 for real
#define UPLINK_FPORT 2
#define CMD_FPORT_FACTORY_RESET 10

Preferences store;

// Persist the LoRaWAN nonces to flash so reflashing/rebooting doesn't reuse a
// DevNonce (which TTS rejects as "DevNonce already used"). Also enable
// "Resets join nonces" on the TTS device while developing.
void saveNonces() {
  store.begin("lorawan", false);
  store.putBytes("nonces", node.getBufferNonces(), RADIOLIB_LORAWAN_NONCES_BUF_SIZE);
  store.end();
}
void restoreNonces() {
  store.begin("lorawan", true);
  if (store.isKey("nonces")) {
    uint8_t buf[RADIOLIB_LORAWAN_NONCES_BUF_SIZE];
    store.getBytes("nonces", buf, RADIOLIB_LORAWAN_NONCES_BUF_SIZE);
    node.setBufferNonces(buf);
  }
  store.end();
}

void readSensors(float &soilTempF, float &airTempF, float &airHum, int &soilRaw, int &soilPct) {
  ds18b20.requestTemperatures();
  soilTempF = ds18b20.getTempFByIndex(0);
  airTempF = dht.readTemperature(true);
  airHum = dht.readHumidity();
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(SOIL_PIN); delay(10); }
  soilRaw = sum / 10;
  soilPct = constrain(map(soilRaw, dryValue, wetValue, 0, 100), 0, 100);
}

// Pack the reading into 9 bytes (see Bring-Up Guide §5a / the TTS decoder).
size_t packPayload(uint8_t *buf) {
  float soilTempF, airTempF, airHum; int soilRaw, soilPct;
  readSensors(soilTempF, airTempF, airHum, soilRaw, soilPct);

  int16_t st = (int16_t)lround((isnan(soilTempF) ? 0 : soilTempF) * 10);
  int16_t at = (int16_t)lround((isnan(airTempF) ? 0 : airTempF) * 10);
  uint8_t hum = (uint8_t)constrain((int)(isnan(airHum) ? 0 : airHum), 0, 100);

  buf[0] = st >> 8;       buf[1] = st & 0xFF;
  buf[2] = at >> 8;       buf[3] = at & 0xFF;
  buf[4] = hum;
  buf[5] = (soilRaw >> 8) & 0xFF; buf[6] = soilRaw & 0xFF;
  buf[7] = (uint8_t)soilPct;
  buf[8] = 0;             // flags (battery/version) — reserved
  Serial.printf("Reading: soilT=%.1fF airT=%.1fF hum=%.0f%% raw=%d moist=%d%%\n",
                soilTempF, airTempF, airHum, soilRaw, soilPct);
  return 9;
}

void handleDownlink(const uint8_t *data, size_t len, uint8_t fPort) {
  Serial.printf("Downlink on fPort %u, %u bytes\n", fPort, (unsigned)len);
  if (fPort == CMD_FPORT_FACTORY_RESET) {
    Serial.println("Cloud command: factoryReset (queued over LoRaWAN). Clearing config + reboot.");
    store.begin("lorawan", false); store.clear(); store.end();
    delay(500);
    ESP.restart();
  }
}

void joinNetwork() {
  Serial.println("LoRaWAN: starting OTAA join (US915 FSB2)...");
  restoreNonces();
  int16_t state = node.beginOTAA(joinEUI, devEUI, nwkKey, appKey);
  if (state != RADIOLIB_ERR_NONE) {
    Serial.printf("beginOTAA failed, code %d. Halting.\n", state);
    while (true) delay(1000);
  }
  // Retry the join until it succeeds; back off so we don't hammer the airwaves.
  while (true) {
    state = node.activateOTAA();
    if (state == RADIOLIB_LORAWAN_NEW_SESSION || state == RADIOLIB_LORAWAN_SESSION_RESTORED) {
      Serial.println("LoRaWAN: JOINED.");
      saveNonces();
      return;
    }
    Serial.printf("Join failed (code %d). See Bring-Up Guide §9. Retrying in 30s...\n", state);
    saveNonces();          // persist the incremented DevNonce between attempts
    delay(30000);
  }
}

void setup() {
  heltec_setup();          // board init: radio pins (8/14/12/13), TCXO, RF switch, Serial, OLED
  Serial.begin(115200);
  analogReadResolution(12);
  delay(500);
  Serial.println("\n=== GrowthPulse LoRaWAN node (bench) ===");

  ds18b20.begin();
  dht.begin();

  // Bring up the SX1262 (heltec_unofficial constructed `radio` with the right
  // pins + 1.6V TCXO already). A bare begin() succeeds on the V3.
  int16_t rs = radio.begin();
  if (rs != RADIOLIB_ERR_NONE) {
    Serial.printf("radio.begin() failed, code %d (TCXO/pins — Guide §9). Halting.\n", rs);
    while (true) delay(1000);
  }

  node.setDutyCycle(false);   // US915 has no duty-cycle limit (fair-use airtime instead)
  joinNetwork();
}

void loop() {
  uint8_t payload[9];
  size_t len = packPayload(payload);

  uint8_t down[64];
  size_t downLen = sizeof(down);
  LoRaWANEvent_t evDown;
  int16_t state = node.sendReceive(payload, len, UPLINK_FPORT, down, &downLen, false, nullptr, &evDown);

  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("Uplink sent (no downlink).");
  } else if (state > 0) {
    Serial.printf("Uplink sent; downlink received in RX%d.\n", state);
    if (downLen > 0) handleDownlink(down, downLen, evDown.fPort);
  } else {
    Serial.printf("sendReceive error, code %d.\n", state);
  }
  saveNonces();

  // Bench: stay awake and wait. Production: replace with deep sleep + RTC
  // session persistence (see Bring-Up Guide §8) to run for months on battery.
  delay(UPLINK_INTERVAL_MS);
}
