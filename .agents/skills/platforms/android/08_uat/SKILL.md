---
name: uat_android
description: Phase 8 lead for Android. Coordinates real stakeholder acceptance on Android Emulator or physical device via Expo Go.
---

# UAT Coordinator (Android Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10.

## Live Preview Protocol
The AI agent must **verify the bundle compilation BEFORE presenting the QR code to the user**:
1. **Expo Account Verification**: Run `npx expo whoami`.
  - If not logged in, prompt user to run `npx expo login` or supply `EXPO_TOKEN`.
2. **Launch Metro Bundler**:
  - Run `cd sandbox && CI=1 npx expo start -c --port 8081` (with `IsDaemon=true`).
  - Wait for endpoint `http://localhost:8081` to return HTTP 200.
3. **Mandatory Pre-Flight Bundle Check (Zero-Crashing Gate)**:
  - Curl the bundle endpoint directly:
    ```bash
    curl -s "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true" | head -n 30
    ```
  - Inspect output: If it contains `UnableToResolveError`, missing modules, or JavaScript syntax crashes, **DO NOT surface the QR code**. Fix the missing dependencies (`expo-doctor`, peer dependencies, router modules) until the bundle returns valid JavaScript (`var __BUNDLE_START_TIME__...`).
4. **Present Verified QR Code**:
  - Only after the bundle compiles cleanly, generate the QR code using `npx --yes qrcode "exp://<IP>:8081" -t png -o docs/expo-qr.png`.
  - Present the QR code and direct deep-link to the user.

## Anti-Hallucination Rule
Never fake Android device runs. Prompt stakeholder to test scenarios in `docs/10_UAT_CHECKLIST.md`.
