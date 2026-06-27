# GrowthPulse LoRaWAN Setup: Teammate Checklist

Your job: get a node running on LoRaWAN through your own gateway and see it live in the app. The app does almost all of it now. You do NOT create anything in The Things Stack by hand, you do NOT generate or paste keys, and there is nothing to send Bryan at the end. The app auto-provisions the node's TTS device and routes its data for you.

**You need:** your own LoRaWAN gateway (e.g. a ThinkNode G1), a Heltec WiFi LoRa 32 V3 node, a USB-C cable, the Arduino IDE, and the latest **GP_Combined.ino** firmware.

### Getting the firmware (always grab the newest)

The combined Wi-Fi + LoRaWAN firmware lives in the repo at `firmware/GP_Combined/GP_Combined.ino` on `main`. Pull or download the newest before flashing. Install these in the Arduino Library Manager: **RadioLib** and **Heltec ESP32 LoRa V3** (by ropg). Board: **Heltec WiFi LoRa 32 V3**, upload speed 115200.

There is nothing to fill in. The firmware already has the provisioning token baked in, so the node registers to the cloud on its own; just flash it as-is. (If a board connects to Wi-Fi but never shows up in the app and the OLED loops on "Setup retry / check internet," you are on an old build with a placeholder token, re-pull the latest from `main`.)

You also do not fill in any LoRaWAN keys; the app pushes those to the board when you switch it to LoRaWAN.

---

## 1. Flash the node and bring it up on Wi-Fi first

1. Flash **GP_Combined.ino**. The board boots into Wi-Fi setup mode.
2. Claim the node in the app like any node (connect to its setup Wi-Fi, give it your Wi-Fi, add it to your account).
3. Confirm sensor data shows up in the app over Wi-Fi. The node fully works at this point. LoRaWAN is the optional switch below, so do it only once Wi-Fi is proven.

## 2. Point your gateway at The Things Stack (the one thing the app can't do)

The app registers the gateway on the network for you, but it can't reach inside the physical gateway to configure it. So set the G1 to forward to our server once.

In the G1's web UI (join its Wi-Fi AP or LAN, browse to `192.168.1.1`, login `root` / `root`):
1. **LoRaWAN -> LoRa Gateway**, set **Mode = Packet Forward**.
2. **Server Address:** `nam1.cloud.thethings.network`   **Port Up/Down:** `1700` / `1700`.
3. **Channel Plan:** **US915** (sub-band 2).
4. **Save & Apply**, then restart the gateway.

## 3. Add the gateway in the app

**Devices -> Add gateway**, then scan or type the **Gateway EUI** from your gateway's label (the `EUI:` line, format `XX:XX:XX:FF:FE:XX:XX:XX`). The app registers it on The Things Stack automatically and ties it to your account. Within a minute or two the gateway should come up as connected. You never log into the TTS console.

## 4. Switch the node to LoRaWAN

In the app, open the node and switch its connection to **LoRaWAN**. Behind the scenes the app:
- generates fresh OTAA keys and creates the node's TTS device for you,
- stores the route so the node's data lands on the same plant it used over Wi-Fi,
- pushes the keys to the board, which reboots into LoRaWAN and joins through your gateway.

The board must be **online over Wi-Fi** when you flip the switch (that is how it receives the keys). If it's offline the switch just queues until it next connects.

## 5. Confirm it's live

The node should reappear in the app within a couple of minutes, now tagged **LoRaWAN**, with readings updating roughly every 60 seconds. That's it. No device IDs, tokens, decoders, or webhooks to set up.

---

## Quick troubleshooting

- **`radio.begin()` error -707** at boot: wrong radio library. Use the **ropg** Heltec ESP32 LoRa V3 library.
- **Node won't join / nothing in the app after switching:** the gateway probably isn't actually connected. Recheck steps 2 and 3 (Packet Forwarder, server `nam1...:1700`, US915 **sub-band 2**, gateway added in the app). Keep the node and gateway 5-10 m apart with a wall between them; too close can desensitize the radio.
- **Need to go back to Wi-Fi:** hold the board's **PRG** button about 3 seconds and it returns to Wi-Fi setup. You can re-switch to LoRaWAN later; it reuses the same identity, so no orphan device is created.

**You're done when:** the node shows live in the app with a LoRaWAN badge and readings refreshing about every 60 seconds.
