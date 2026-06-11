# Welcome to GrowthPulse

Thank you for choosing GrowthPulse, the smart plant monitoring system that watches over your plants around the clock and tells you exactly what they need. This manual covers everything: setting up your device, connecting it to your home Wi-Fi, pairing it with your GrowthPulse account, and getting the most out of every feature in the app.

If you only read one section, read **Quick Start**. It gets you from box to live readings in about five minutes.

**The app lives at growthpulsecloud.com.** It works in any browser on your phone, tablet, or computer, and it can be installed on your phone's home screen like a regular app (see "Install the app on your iPhone").

---

# Safety and Care

- The GrowthPulse unit is powered by USB-C at 5 volts, the same kind of charger as most modern phones. Use any standard USB-C power adapter.
- The main electronics enclosure is **not waterproof**. Keep it out of rain and away from direct watering. Only the soil probes are designed to touch soil and water.
- The soil temperature probe (the metal-tipped probe on a cable) is waterproof and safe to bury in soil.
- The soil moisture probe may be inserted into soil up to its marked line. Do not submerge the electronics at the top of the probe.
- Operating temperature: the unit is happiest between 32°F and 120°F (0°C to 49°C). For outdoor use, shelter it from direct rain and harsh sun.
- There are no user-serviceable parts inside the enclosure.

---

# In the Box

- 1x GrowthPulse smart monitoring unit (with built-in display)
- 1x waterproof soil temperature probe
- 1x air temperature and humidity sensor
- 1x capacitive soil moisture probe
- 1x USB-C power cable
- Quick start card with your unit's pairing code

Your unit's **pairing code** is also shown directly on the unit's built-in screen whenever it is powered, so you can never lose it.

---

# Meet Your Device

**The screen.** The built-in display walks you through setup and then cycles every few seconds through three pages so you always have the information you need at a glance:

- **Pairing page**: your unit's pairing code in large letters, with a status indicator. **ON** means your unit is connected and streaming, two dots (..) mean it is still connecting.
- **Connection page**: how the unit is connected right now (Wi-Fi or LoRaWAN), its signal strength, and its battery or power state.
- **Readings page**: the latest live sensor values. A probe that is not plugged in reads "--" honestly rather than showing a fake number.

**The PRG button.** One button does everything, and what it does depends on how you use it:

- **Single tap**: wakes the screen (or wakes the unit from sleep).
- **Double tap**: puts the unit to sleep (a soft power-off). The screen turns off and the unit sips almost no power, so a battery can last for months. A single tap or the RESET button wakes it; it reconnects on its own.
- **Hold 10 seconds**: full reset. The unit forgets its saved Wi-Fi and reopens setup mode. Use this when you move to a new home, change your Wi-Fi password, set the unit up somewhere new, or hand it to a new owner. The screen tells you when the reset is about to happen.
- **Hold 3 seconds** (advanced): if a Farm Kit node is on LoRaWAN and you want to bring it back to your Wi-Fi, this returns it to Wi-Fi mode while keeping your saved network, so you do not have to set up Wi-Fi again.

For day-to-day use you never need the button at all.

**The USB-C port.** Power in. Plug it into any standard USB-C wall adapter. Battery-powered units also charge through this port.

**The sensors.** Three sensors feed your dashboard: air temperature and humidity (the vented sensor), soil temperature (the metal probe), and soil moisture (the flat blade probe). Place the soil probes in the pot or bed you want to monitor, near the plant's root zone but not touching the stem.

---

# Quick Start

1. **Plug in your GrowthPulse** with the USB-C cable. The screen lights up and says it is starting.
2. **On your phone, open Wi-Fi settings** and join the network named **GrowthPulse-XXXXXX** (the exact name shows on the unit's screen).
3. A **setup page opens automatically**. Pick your home Wi-Fi from the list, type your Wi-Fi password, and tap save. If the page does not pop up within 15 seconds, open your browser and go to **192.168.4.1**.
4. The unit connects and its screen shows your **pairing code** in big letters with the ON indicator.
5. **Go to growthpulsecloud.com**, create your account, tap **Connect a device**, and enter the pairing code from the screen. Done, your plant is live.

---

# Connecting to Wi-Fi (Detailed)

Your GrowthPulse connects to the internet through your home Wi-Fi. It only needs to do this once; afterward it reconnects on its own, even after power outages.

**Setup mode.** A brand-new unit (or one that has been reset) automatically opens setup mode: it broadcasts its own temporary Wi-Fi network named GrowthPulse-XXXXXX and shows those instructions on its screen.

**Joining from your phone:**

1. Open your phone's Wi-Fi settings and join the GrowthPulse-XXXXXX network. It has no password.
2. Your phone will detect that this network needs a sign-in and open the GrowthPulse setup page on its own.
3. If your phone says "this network has no internet access," choose **Keep trying Wi-Fi** or **Use this network anyway**. That is expected, the unit is not on the internet yet, that is why you are setting it up.
4. If the setup page never appears, open any browser and type **192.168.4.1** in the address bar. The setup page is there.

**On the setup page:** you will see the GrowthPulse welcome screen. Tap Configure WiFi, choose your home network from the list, enter your Wi-Fi password, and save.

**Good to know:**

- GrowthPulse uses **2.4 GHz Wi-Fi**, which has much better range through walls than 5 GHz. If your router broadcasts separate names for 2.4 and 5 GHz, pick the 2.4 GHz one.
- Setup mode stays open for 10 minutes. If it times out, the unit restarts and opens setup mode again.
- Turning off cellular data during setup helps some phones show the setup page faster.

**Changing Wi-Fi later** (new router, new password, new home): hold the **PRG button for 10 seconds**. The screen shows it is resetting, the unit restarts into setup mode, and you repeat the steps above. Your account, plant data, and settings are not affected, only the saved Wi-Fi is cleared so you can enter the new network.

---

# Your Account and Pairing

**Creating an account.** At growthpulsecloud.com choose Create an account. Enter your first and last name, email, and a password (entered twice to catch typos), and tell us how you grow: Hobbyist, Home grower, Farmer, or Commercial. This helps us tailor the experience.

**Trying before buying.** The **Explore the demo** button on the sign-in screen opens a fully working sandbox with sample plants, no account needed. Demo data is clearly separate and never mixes with a real account.

**Pairing your device.** From a new account you will see the welcome screen, tap **Connect a device**. You will be asked for:

- **How it connects**: Wi-Fi (most units) or through a LoRaWAN gateway (Farm Kit).
- **Plant name**: whatever you like, "Kitchen Basil," "Greenhouse Tomatoes."
- **The pairing code**: the large code on your unit's screen.

A code that does not match a real GrowthPulse unit is rejected, so a typo cannot create a ghost device.

**Location is optional.** You are never asked for your location to set up a plant, and the app never reads your phone's GPS. A plant's home location (a city or ZIP) is only used by the weather features, the forecast, rain alerts, and rain delay. If you want those, you can add a location any time from the plant's weather card or its edit screen. If you would rather not share where you live, simply skip it; everything else works exactly the same.

**Your plants follow your account.** Devices are stored with your account in the cloud, not in one browser. Sign in on a new phone or computer and your plants, names, locations, and groups are already there. A pairing code can also only be claimed by one account at a time, so a unit always has a single clear owner.

**Privacy:** every account's plants, history, journals, and alarms are private to that account.

---

# The Live Dashboard

The Live tab is your plant's homepage.

**The big three numbers** across the top: air temperature, humidity, and soil moisture. Each is colored by status, green is ideal for your plant, amber is getting outside the comfort zone, red needs attention. A sensor that is not plugged in shows a dash and says "not connected" rather than pretending.

**The moisture gauge and health score.** The dial shows soil moisture at a glance. Next to it, the **plant health score** (0 to 100) blends every connected sensor against your plant's ideal ranges. Below them you can see how the device is connected, its power status, and the plant's location.

**Plant profile.** Tap the plant bar to tell GrowthPulse what you are growing, basil, tomatoes, succulents, ferns, and more. Every plant type has its own ideal ranges, so the colors, health score, and advice are tuned to that plant, not a generic average.

**Weather rain gauge.** Shows current weather at your plant's home location: temperature, conditions, rain chance, and the day's high. When rain is likely, GrowthPulse suggests skipping a watering. When intense sun and heat are coming, it warns you that soil may dry out faster. (Available on Plus and above.) If you have not given this plant a location, the card simply invites you to add one, a city or ZIP, right there; nothing is forced and your phone's location is never used.

**Automated watering.** With a Pro plan and a pump accessory, GrowthPulse can water automatically when soil gets too dry.

**Rain delay.** On Pro, you can turn on **rain delay** so automatic watering is skipped when rain is in the local forecast, no overwatering right before a storm. Because rain delay has to look up the forecast where the plant lives, it needs that plant's home location. If the plant has no location yet, the rain delay switch explains why and lets you add one (a city or ZIP) on the spot; once it is set, rain delay turns on. This is the one feature that requires a location, and it tells you exactly which plant still needs one.

**Sensors row.** Every sensor with its live reading and a trend arrow. Tap any of them for a detailed chart with max, average, and minimum. A disconnected sensor is shown in gray as "not connected."

**Insights.** Plain-English advice generated from your readings: "Soil is very dry. Water the plant now," "Humidity is low. Consider misting," and so on. If a sensor is unplugged, Insights tells you exactly which wire to check. If a battery-powered unit is running low, the warning appears here too.

**Growth journal.** Add dated notes and photos to track your plant's story: repotting, pruning, first flowers. Photos appear in your shareable reports.

---

# History

The History tab shows charts for every sensor over the last hour, day, week, or month, with your plant's ideal band shaded so you can see at a glance when conditions drifted. Max, average, and minimum are displayed for the selected window. Units follow your settings (°F or °C).

---

# Alarms

Alarms watch your readings and alert you the moment something crosses a line you set.

- **Create an alarm** with a sensor, a direction (above or below), and a value, for example "soil moisture below 25%."
- Alarms can apply to all devices or one specific plant.
- **Suggested alarms**: GrowthPulse can create a sensible starter set tuned to your plant profile with one tap.
- When an alarm trips, a notification banner appears in the app, and with email or SMS alerts enabled in Settings, GrowthPulse contacts you even when the app is closed.

---

# Devices

The Devices tab lists every plant on your account.

**Groups.** Have more than a couple of plants? Open any device's edit screen and give it a group, "Greenhouse," "Backyard," "Office." The Devices tab then organizes your plants under those headings.

**Power status.** Each card shows how the unit is powered: **AC power** for plugged-in units, or a battery percentage for battery-powered units, with a charging indicator. Low battery turns the badge amber, then red, and the app warns you before the unit goes offline.

**Editing a device.** Tap the pencil on any card to rename the plant, set or change its home location, change its group, or switch how it connects (Wi-Fi or LoRaWAN gateway).

**Switching how a node connects.** In the edit screen you can move a node between Wi-Fi and LoRaWAN, and the app does the whole setup for you. Switching a Wi-Fi node to LoRaWAN sets it up on your gateway behind the scenes and the node reboots and joins on its own, no codes to copy anywhere. Switching a LoRaWAN node back to Wi-Fi sends it a message that takes effect on its next check-in (LoRaWAN nodes check in every few minutes, so give it a minute or two), after which it rejoins your Wi-Fi. The plant stays the same plant on your dashboard the whole time; only the way it reaches the internet changes.

**Removing a device.** In the edit screen's danger zone, "Remove from my account" takes the device off your account and deletes its history, journal photos, and alarms. The physical unit keeps working and can be paired again any time.

**Selling or gifting a unit: Factory reset.** Also in the danger zone. This permanently deletes everything tied to the plant from your account, and if the unit is online, it remotely wipes its own Wi-Fi and reboots into setup mode, ready for its new owner to unbox a fresh experience. Read the confirmation carefully: this cannot be undone, and if you ever reconnect the unit you will be starting from scratch. (If the unit is offline at the time, the new owner can simply hold PRG for 10 seconds to reset it.)

---

# Power, Battery, and Sleep

Most units run on USB-C wall power and show **AC power** on their card. Battery-powered units (and the Farm Kit nodes) show a **battery percentage** with a charging indicator, and the card turns amber, then red, as the battery runs low, with a warning in the app before the unit goes offline.

**Sleep (soft power-off).** You do not need to unplug a unit to turn it off. **Double-tap the PRG button** and the unit drops into deep sleep: the screen goes dark and it draws almost no power, so a battery can last for months between charges. It sends no readings while asleep. **A single tap or RESET wakes it**, and it reconnects to your Wi-Fi and account on its own.

**Charging.** Plug a battery unit into USB-C to charge. The card shows a charging bolt while it is taking a charge. The percentage rises gently rather than jumping, so what you see tracks the real charge level.

---

# LoRaWAN and the Farm Kit

Wi-Fi works wonderfully indoors and around the house. For fields, large gardens, and far greenhouses, GrowthPulse offers **LoRaWAN**, long-range, low-power radio that reaches miles.

- The **Farm Kit** includes a gateway, the one piece that connects to the internet (plug it into your router). Sensor nodes then join through the gateway automatically, no Wi-Fi setup per node at all.
- **Add the gateway in the app**: Devices tab, **Add a LoRaWAN gateway**, then enter or scan the Gateway EUI from its label (the 16-character ID on the EUI line). The app registers the gateway on the network for you. You never log in to any network console.
- **Buying more nodes later?** Power them on within range and pair with the code on their screen. Each node sets up its own identity automatically, and the gateway part is already done.
- **Moving a plant between transports** is done entirely in the app from the device's edit screen (see "Switching how a node connects" under Devices). You never copy keys or codes anywhere.
- LoRaWAN nodes report every few minutes rather than every few seconds. That slower pace is what makes batteries last for months and signals reach for miles, perfect for plants, which do not change by the second. Because of this slower check-in, a setting you change for a LoRaWAN node (like switching it back to Wi-Fi) takes effect on its next check-in, usually within a minute or two.

---

# Settings

- **Plan**: see your current plan and upgrade.
- **Temperature units**: °F or °C, applied everywhere instantly.
- **Theme**: light, dark, or automatic with your device.
- **Refresh rate**: how often the app updates readings, from every second to every 5 minutes. Second-by-second rates apply to Wi-Fi devices; LoRaWAN nodes check in every few minutes by design. Remember: on battery-powered units, faster updates mean shorter battery life.
- **Notifications**: enable email and SMS alerts and set the addresses they go to.
- **Account**: your name, grower type, email, **Download report (PDF)**, and sign out.

---

# Reports

GrowthPulse turns your sensor history into a polished, branded PDF report you can keep, print, or share, complete with graphs.

**Where to find it.** Open **Settings** and tap **Download report (PDF)**. (Note: this replaced the old plain-text data export; the report is what 99% of people actually want.)

**Choose what goes in it.** A short options screen lets you tailor the report before it builds:

- **Time period**: Last 24 hours, Last 7 days, Last 30 days, **Everything** (all the way back to when each plant first connected), or **Custom dates** with your own from/to.
- **Plants**: if you have more than one plant, tick exactly which ones to include.
- **Sensors**: include or leave out Temperature, Humidity, Soil Moisture, and Soil Temp, your choice.

**What's in the report.** For each plant you get a line chart per sensor across the whole period, with the plant's ideal range shaded green and the minimum, average, and maximum called out. Gaps in a line mean the device was offline then; a sensor that was unplugged is labeled honestly instead of drawing a fake line. Below the graphs is an **activity timeline** (when the plant was added, first data, your journal notes) and a clean summary of your devices, alarms, and settings. Long periods are automatically averaged so the graphs stay readable.

**Two ways to get it.**

- **Download PDF** saves the file straight to your device, one tap, no dialog.
- **Print report** opens your browser's print view, where you can save as PDF with the sharpest possible text or print on paper.

A loading screen with a spinner shows while the report builds (it can take a few seconds for long periods or the highest-quality rendering), so you know it's working, no need to tap again or refresh.

Great for plant sitters, garden clubs, agronomy classes, landlords, or just tracking how your plants are doing over a season.

---

# Install the App on Your iPhone

1. Open **growthpulsecloud.com** in Safari.
2. Tap the **Share** button, then **Add to Home Screen**.
3. You get a GrowthPulse icon on your home screen, and the app opens full screen, just like an app from the App Store. Android works the same way through Chrome's "Add to home screen."

---

# Troubleshooting

| Problem | What to do |
|---------|------------|
| The setup page never opens after joining GrowthPulse-XXXXXX | Open a browser and go to 192.168.4.1. Also try turning off cellular data during setup. |
| My phone says the GrowthPulse network has no internet | That is normal during setup. Choose "Keep trying Wi-Fi" or "Use this network anyway." |
| The unit will not connect to my Wi-Fi | Make sure you picked the 2.4 GHz network and re-entered the password carefully. Hold PRG 10 seconds to start over. |
| The screen shows two dots instead of ON | The unit is still connecting. If it stays that way, your Wi-Fi may be out of range or the password changed. Hold PRG 10 seconds to redo setup. |
| A sensor shows "not connected" | That probe is not plugged in or its cable is loose. The Insights card names the exact sensor. Reseat the cable. |
| The pairing code is rejected | Codes only contain letters and numbers, check for typos (the code is on the unit's screen). |
| Readings look stuck | Check that the unit's screen shows ON. Pull the power and plug it back in, it reconnects by itself. |
| I moved or changed my router | Hold PRG 10 seconds and run Wi-Fi setup again. Nothing else changes. |
| Download PDF seems slow the first time | The high-quality renderer wakes up on the first use, then is quick. The loading spinner means it's working, just wait; it will save automatically. |
| Print report does not open | Your browser blocked the pop-up. Allow pop-ups for growthpulsecloud.com once, or use Download PDF instead. |
| I want rain delay but the switch is off | Rain delay needs the plant's location for the forecast. The switch shows a box to add a city or ZIP; once saved, it turns on. |
| The screen is dark and the unit seems off | It is probably asleep (a double-tap of PRG puts it to sleep). Tap PRG once or press RESET to wake it; it reconnects on its own. |
| I switched a node to Wi-Fi in the app but it is still on LoRaWAN | LoRaWAN nodes only act on a change at their next check-in, which is every minute or two. Give it a couple of minutes; it will switch and rejoin Wi-Fi on its own. |
| A battery unit shows a percentage that seems stuck right after plugging in | The percentage rises gently on purpose so it tracks the real charge instead of jumping. It will keep climbing while charging. |

---

# FAQ

**Does GrowthPulse work without internet?** The unit needs internet (through your Wi-Fi or a Farm Kit gateway) to send readings to your app. If the connection drops, it reconnects automatically when service returns.

**Can multiple people watch the same plants?** Each account has its own plants. Family-sharing is on our roadmap.

**Does the app track my location?** No, and it never asks your browser or phone for it. Weather uses only the home location you choose to type for a plant (a city or ZIP). If you skip it, weather and rain delay are simply off for that plant and nothing else changes. Location is always optional and always something you enter yourself.

**Can I sign in on more than one device?** Yes. Your plants live with your account in the cloud, so signing in on a new phone or computer shows all your plants, names, locations, and groups right away.

**How accurate are the sensors?** Air temperature is typically within ±0.9°F, humidity within ±2-5%, and soil readings are tuned for trend accuracy, watching change over time, which is what plant care decisions actually need.

**Can I move a plant's probe to a different pot?** Yes, just move it. Consider renaming the plant and updating its plant profile so the advice stays accurate.

**What happens to my data if I remove a device?** Its history, journal, photos, and alarms are deleted from your account immediately.

**Can I move a plant from Wi-Fi to LoRaWAN, or back, later?** Yes, any time, from the device's edit screen. The app handles the setup for you and the plant stays the same plant on your dashboard. A switch back to Wi-Fi takes effect on the node's next LoRaWAN check-in (a minute or two), because LoRaWAN nodes only listen briefly between their scheduled reports.

**How do I turn a unit off?** Double-tap the PRG button to put it to sleep (a soft power-off that sips almost no power). Tap once or press RESET to wake it. There is no need to unplug it.

**Do I have to set anything up on a LoRaWAN network?** No. Adding a gateway and switching nodes to LoRaWAN are done entirely in the GrowthPulse app. You never log in to any network console or copy any keys.

---

# Specifications

| Item | Specification |
|------|---------------|
| Power | 5V USB-C, under 2.5W typical; optional rechargeable battery on Farm Kit nodes |
| Battery life | Months per charge on LoRaWAN nodes (low-power reporting, sleep between reads) |
| Wi-Fi | 2.4 GHz, 802.11 b/g/n |
| Long range option | LoRaWAN, US 915 MHz (FSB2), via Farm Kit gateway |
| Power button | Single tap wake, double tap sleep, 10-second hold to reset Wi-Fi |
| Display | Built-in OLED, rotating pairing code, connection, and live readings |
| Air sensor | Temperature and relative humidity |
| Soil temperature | Waterproof probe |
| Soil moisture | Capacitive (corrosion-resistant, no exposed metal contacts) |
| Reporting rate | Every few seconds on Wi-Fi, every few minutes on LoRaWAN |
| App | growthpulsecloud.com, installable on iPhone and Android home screens |

---

GrowthPulse · Smart Plant Monitoring · growthpulsecloud.com
