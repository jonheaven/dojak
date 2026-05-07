# USB Fingerprint Setup (Windows)

## Windows Hello-compatible readers (including many Newegg models)

1. Plug in the USB fingerprint reader.
2. Install the vendor driver package if Windows does not auto-install it.
3. Open Windows Settings -> Accounts -> Sign-in options.
4. Under Fingerprint recognition (Windows Hello), add at least one fingerprint.
5. In supported Chromium browsers, ensure secure context is enabled for WebAuthn.
6. In the Dojak extension unlock flow, enable biometric unlock after a successful password unlock.

## Digital Persona U.are.U 4500

1. Install official Digital Persona U.are.U 4500 drivers from the vendor package.
2. Install and run the local DigitalPersona Agent service (one-time setup).
3. Confirm the agent is running and listening locally (common ports are `9001` and `15326`).
4. If your IT policy blocks localhost WebSocket traffic, allow local loopback for the browser profile.
5. Verify the sensor can capture a fingerprint in the vendor test utility.
6. Keep the agent running while the browser extension is open.
7. In extension settings/unlock flow, enable biometric unlock.

## Troubleshooting

- If biometrics are unavailable, check:
  - Sensor is plugged in and recognized by OS
  - Fingerprint enrollment exists in OS settings
  - Browser supports WebAuthn and hardware auth in current mode
  - U.are.U local agent service is running and reachable
  - DigitalPersona browser SDK bridge is loaded in extension popup/content UI
- If too many biometric failures occur, wait for lockout timeout and use password fallback.
