// GrowthPulse bench diagnostic: ADC scanner.
// Prints several analog pins side by side so you can see which one responds.
// Jumper test: touch 3V3 to a pin (expect ~4095) or GND (expect ~0).
const int PINS[] = {1, 2, 3, 6, 7};
const int N = 5;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  delay(500);
  Serial.println();
  Serial.println("ADC scanner. Touch 3V3 to a pin; its number should jump to ~4095.");
}

void loop() {
  for (int i = 0; i < N; i++) {
    Serial.print("GPIO");
    Serial.print(PINS[i]);
    Serial.print("=");
    Serial.print(analogRead(PINS[i]));
    Serial.print("\t");
  }
  Serial.println();
  delay(500);
}
