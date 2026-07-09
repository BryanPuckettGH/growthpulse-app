/* ============================================================
   GrowthPulse Valve Control Firmware
   Board: ESP32
   Driver: DRV8871 H-bridge
   Valve: Galcon S1602 latching solenoid
   Developer: Raymond Capahi
   ============================================================ */

// Valve control pins
#define VALVE_IN1 33
#define VALVE_IN2 34  // SAFETY FIX: Changed from 34 (Pin 34 is input-only on ESP32)

// Timing configurations
#define VALVE_PULSE_MS 60    // 60ms is the sweet spot for the Galcon S1602 at 12V
#define COOLDOWN_MS 5000     // 5-second mandatory cooldown between pulses

// State tracking variables
unsigned long lastPulseTime = 0;
int currentValveState = -1;  // -1 = Unknown, 0 = Closed, 1 = Open

void setup() {
  Serial.begin(115200);
  
  // Initialize valve pins and ensure they start LOW to prevent accidental firing
  pinMode(VALVE_IN1, OUTPUT);
  pinMode(VALVE_IN2, OUTPUT);
  digitalWrite(VALVE_IN1, LOW);
  digitalWrite(VALVE_IN2, LOW);

  delay(1000);
  Serial.println("\n==================================");
  Serial.println("GrowthPulse Valve Controller Ready");
  Serial.println("Safety Cooldown: 3 Seconds");
  Serial.println("Send '1' to OPEN valve.");
  Serial.println("Send '0' to CLOSE valve.");
  Serial.println("==================================");
}

// Pulses the latching irrigation valve safely
void pulseValve(bool openCommand) {
  // 1. STATE CHECK: Prevent duplicate commands
  if (currentValveState == (openCommand ? 1 : 0)) {
    Serial.println("IGNORED: Valve is already in the requested state.");
    return;
  }

  // 2. COOLDOWN CHECK: Prevent rapid-fire spamming
  if (millis() - lastPulseTime < COOLDOWN_MS) {
    unsigned long timeRemaining = (COOLDOWN_MS - (millis() - lastPulseTime)) / 1000;
    Serial.print("IGNORED: Cooldown active. Please wait ");
    Serial.print(timeRemaining + 1);
    Serial.println(" seconds.");
    return;
  }

  Serial.print(openCommand ? "OPENING valve... " : "CLOSING valve... ");

  // 3. EXECUTE PULSE
  digitalWrite(VALVE_IN1, openCommand ? HIGH : LOW);
  digitalWrite(VALVE_IN2, openCommand ? LOW  : HIGH);
  
  delay(VALVE_PULSE_MS);
  
  // 4. FAILSAFE CUTOFF: Guarantee zero current flow after pulse
  digitalWrite(VALVE_IN1, LOW);
  digitalWrite(VALVE_IN2, LOW);
  
  // Update state tracking
  lastPulseTime = millis();
  currentValveState = openCommand ? 1 : 0;
  
  Serial.println("Done.");
}

void loop() {
  // Check if data is available in the Serial buffer
  if (Serial.available() > 0) {
    char inChar = (char)Serial.read();
    
    if (inChar == '1') {
      pulseValve(true);
    } 
    else if (inChar == '0') {
      pulseValve(false);
    }
    
    // Clear the rest of the serial buffer (removes newline characters)
    while (Serial.available() > 0) {
      Serial.read();
    }
  }
}
