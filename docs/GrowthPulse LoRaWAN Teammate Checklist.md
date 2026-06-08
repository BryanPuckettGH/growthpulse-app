# GrowthPulse LoRaWAN Setup — Teammate Checklist

Your job: get the node talking to The Things Stack through the gateway, and confirm real sensor data shows up in the TTS console. You can do all of this on your own free account, you do NOT need Bryan's GitHub or Netlify. The full reference (with troubleshooting) is **GrowthPulse LoRaWAN Bring-Up Guide.pdf**; this is the short version.

**You need:** your own LoRaWAN gateway (e.g. a ThinkNode G1), a Heltec WiFi LoRa 32 V3 node, a USB-C cable, the Arduino IDE, and the latest **GP_LoRaWAN.ino** firmware (see "Getting the firmware" below).

### Getting the firmware (always grab the newest)

The node firmware lives in GitHub, so you always pull the current version:

1. Clone the repo (you have collaborator access): `git clone https://github.com/BryanPuckettGH/growthpulse-app.git`
2. Switch to the LoRaWAN branch: `git checkout lorawan-bringup` (or `main` once it's merged).
3. Open `firmware/GP_LoRaWAN/GP_LoRaWAN.ino`.

Prefer the browser? On github.com open the repo, switch the branch dropdown to **lorawan-bringup**, go to `firmware/GP_LoRaWAN/GP_LoRaWAN.ino`, and use **Download raw file**. Always re-pull / re-download before flashing so you have the newest firmware.

**Two things to send Bryan at the end** (this is how your half connects to the app):
1. The **device ID** of the end device you create in TTS (step 4).
2. Agree on a **webhook secret token** (any long random string). You'll paste it into the TTS webhook; Bryan puts the same string in Netlify.

---

## 1. Create your account + register the gateway

1. Go to **https://nam1.cloud.thethings.network/console** (North America cluster). Sign up / log in (login is via eu1, that's normal; you still manage everything on nam1).
2. **Gateways → + Register gateway.**
3. **Gateway EUI:** the 16-hex-character EUI printed on **your own** gateway's label (the `EUI:` line, format `XX:XX:XX:FF:FE:XX:XX:XX`). Use the gateway you physically have, not anyone else's. → Confirm.
4. **Frequency plan:** **United States 902-928 MHz, FSB 2 (used by TTN)**. (This is sub-band 2, mandatory.)
5. **Register gateway.**

## 2. Point the ThinkNode G1 at The Things Stack

In the G1's web UI (join its Wi-Fi AP or LAN, browse to `192.168.1.1`, login `root` / `root`):
1. **LoRaWAN → LoRa Gateway**, set **Mode = Packet Forward**.
2. **Server Address:** `nam1.cloud.thethings.network`  **Port Up/Down:** `1700` / `1700`.
3. **Channel Plan:** **US915** (sub-band 2).
4. **Save & Apply**, restart the gateway.
5. Back in the TTS console, open the gateway → it should say **Connected**, and **Live data** should show traffic.

## 3. Create the application

**Applications → + Create application** → Application ID `growthpulse` → Create.

## 4. Register the node (end device, OTAA)

**End devices → + Register end device → Enter end device specifics manually:**
- **Frequency plan:** United States 902-928 MHz, **FSB 2** (must match the gateway).
- **LoRaWAN version:** **MAC 1.0.4**.   **Regional Parameters:** **RP002 1.0.4**.
- **Activation mode:** **OTAA**.
- **JoinEUI / AppEUI:** all zeros `0000000000000000`.
- **DevEUI:** click **Generate**.
- **AppKey:** click **Generate**.
- **End device ID:** note this down — **this is the device ID you send Bryan.**
- **Register end device.**

Then open the device → **General settings → Join settings → enable "Resets join nonces"** (lets you reflash during testing without join errors).

## 5. Flash the node and prove the join

1. Open **GP_LoRaWAN.ino** in Arduino IDE. Install libraries (Library Manager): **RadioLib**, **Heltec ESP32 LoRa V3** (by ropg).
2. Fill in from your TTS device page (Console shows them, with a "copy" and an MSB-first toggle):
   - `devEUI` = your generated DevEUI
   - `appKey[16]` and `nwkKey[16]` = your generated AppKey (same value in both)
   - leave `joinEUI = 0`
3. Board: **Heltec WiFi LoRa 32 V3**. Upload speed 115200. Flash it.
4. Open Serial Monitor at 115200. You want to see **"LoRaWAN: JOINED."** then **"Uplink sent."**
5. In the TTS console, open the **device → Live data**. You should see the **join-accept**, then **uplinks** arriving every ~60 seconds.

## 6. Add the payload decoder (so the bytes become real numbers)

**Application → Payload formatters → Uplink → Custom JavaScript**, paste the decoder from the Bring-Up Guide §5b (the `decodeUplink` function). Save. Now the device Live data shows `soilTemperatureF`, `airTemperatureF`, `airHumidity`, `soilRaw`, `soilMoisturePercent` decoded.

## 7. Set up the webhook (connects to the app — needs Bryan's side too)

**Application → Integrations → Webhooks → + Add webhook → Custom webhook:**
- **Format:** JSON
- **Base URL:** `https://growthpulsecloud.com/.netlify/functions/lorawan-uplink`
- **Uplink message** path: `/`
- **Add header:** name `X-Webhook-Token`, value = the **secret token** you agreed with Bryan.
- Create it.

This will show errors until Bryan deploys his side and sets the matching token, that's expected. Your job is done when the **device Live data shows decoded uplinks** (step 6). The app showing the data is Bryan's half.

---

## Quick troubleshooting (full table in the Bring-Up Guide §9)

- `radio.begin()` error -707 → TCXO; make sure you used the ropg Heltec library.
- Nothing in **gateway** Live data → sub-band wrong, or node and gateway too close (put them 5-10 m apart with a wall).
- Join request in **gateway** Live data but not **device** Live data → DevEUI/JoinEUI/AppKey don't match what you flashed.
- Joined once, then "DevNonce already used" → make sure "Resets join nonces" is on (step 4).

**You're done when:** the TTS device Live data shows uplinks every ~60s with decoded sensor values, and you've sent Bryan (1) the device ID and (2) the agreed webhook token.
