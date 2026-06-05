# GrowthPulse Production Deployment and Onboarding Model

## Commercialization and Manufacturing

GrowthPulse is delivered to the end user as a finished, plug-and-play product rather than a development kit. The sensor nodes are built on the ESP32-S3 platform, procured as bare modules and provisioned in-house. During production, each unit is flashed with the GrowthPulse firmware and assigned a unique device identity before it is enclosed, packaged, and shipped. Distribution is handled through standard retail channels such as Amazon, as well as direct sales through the GrowthPulse storefront. Because the firmware is installed during manufacturing, the customer receives a device that is ready to operate immediately and never interacts with the development toolchain or programs the hardware themselves.

## Customer Onboarding and Device Provisioning

The onboarding process is designed to require no technical knowledge. The customer powers the unit using a standard USB-C power adapter or the integrated rechargeable battery; a connection to a personal computer is never required. On first power-up, the firmware enters a provisioning mode in which the unit broadcasts a temporary WiFi access point. Using a smartphone, the customer connects to this access point and is presented with a configuration page served directly by the device. Through this page the customer selects their home WiFi network and supplies the password. The device then stores the credentials, exits provisioning mode, and joins the home network, from which point it communicates with the GrowthPulse cloud over the internet.

## Account Association

To ensure that telemetry remains private to its owner, each device must be bound to a single user account. When provisioning is performed while the customer is signed in to the GrowthPulse application, the application transmits a one-time ownership token to the device, which the device presents to the cloud during its first connection. This results in the unit being automatically associated with the correct account with no manual entry required. As a fallback, a unique claim code and matching QR code are printed on each unit's label and may be entered in the application to bind the device. After association, the cloud authorizes only the owning account to view that device's data.

## Cloud Architecture and Data Ownership

The customer never interacts with, nor is aware of, the underlying cloud platform. All data ingestion, storage, threshold evaluation, and notification delivery are handled by a single managed backend operated by GrowthPulse. Every fielded unit is represented within this backend and mapped to its owner in the application's user database. The customer experience is confined entirely to the GrowthPulse application, which presents live readings, historical trends, plant profiles, alarms, and notifications. This separation of concerns allows the backend to be maintained, scaled, or migrated without any change to the customer or the device.

## Security Considerations

Device credentials are provisioned on a per-unit basis. A shared master credential is never embedded in shipped firmware, because extraction of such a credential would compromise the entire fleet. Each unit either receives unique credentials at the time of manufacturing or obtains them from a provisioning service on first contact using a single-use token. WiFi credentials entered by the customer are stored only on the device itself, and all communication between the device and the cloud is encrypted in transit.

## Division of Responsibility

The system divides cleanly into a manufacturer side and a customer side. The manufacturer side comprises firmware development, unit flashing, identity provisioning, packaging, and operation of the cloud backend. The customer side comprises only powering the unit, supplying home WiFi credentials through the provisioning page, and using the GrowthPulse application. No firmware, cloud account, or technical configuration is exposed to the customer at any point.
