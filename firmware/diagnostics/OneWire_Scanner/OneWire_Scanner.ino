// GrowthPulse bench diagnostic: 1-Wire scanner.
// Searches pins 4, 6, 7 for 1-Wire devices. A real DS18B20 announces with an
// address starting 0x28; "nothing" means the probe never reaches the bus
// (check power, contact, and the 4.7k pull-up).
#include <OneWire.h>
#include <DallasTemperature.h>

const int PINS[] = {4, 6, 7};

void scanPin(int pin) {
  OneWire ow(pin);
  byte addr[8];
  int found = 0;
  ow.reset_search();
  Serial.print("Pin ");
  Serial.print(pin);
  Serial.print(": ");
  while (ow.search(addr)) {
    found++;
    Serial.print("DEVICE FOUND  address ");
    for (byte i = 0; i < 8; i++) {
      if (addr[i] < 16) Serial.print("0");
      Serial.print(addr[i], HEX);
    }
    Serial.print("  ");
  }
  if (!found) {
    Serial.println("nothing");
    return;
  }
  Serial.println();
  DallasTemperature sensors(&ow);
  sensors.begin();
  sensors.requestTemperatures();
  Serial.print("   temperature: ");
  Serial.print(sensors.getTempFByIndex(0));
  Serial.println(" F");
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println();
  Serial.println("1-Wire scanner. Checking pins 4, 6, 7...");
}

void loop() {
  for (int i = 0; i < 3; i++) scanPin(PINS[i]);
  Serial.println("---------------------------");
  delay(2000);
}
