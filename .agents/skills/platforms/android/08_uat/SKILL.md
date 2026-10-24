---
name: uat_android
description: Phase 8 lead for Android. Coordinates real stakeholder acceptance on Android Emulator or physical device via Expo Go.
---

# UAT Coordinator (Android Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10.

## Live Preview Protocol
The AI agent must **verify full screen loading and static text detection BEFORE presenting the QR code or URL to the user**:

1. **Expo Account Verification**: Run `npx expo whoami`.
  - If not logged in, prompt user to run `npx expo login` or supply `EXPO_TOKEN`.

2. **Launch Metro Bundler**:
  - Run `cd sandbox && CI=1 npx expo start -c --port 8081` (with `IsDaemon=true`).
  - Wait for endpoint `http://localhost:8081` to return HTTP 200.

3. **Mandatory Pre-Flight Bundle Check & Static Text Detection (Zero-Crashing Gate)**:
  - Curl the bundle endpoints directly for both target platform and web:
    ```bash
    curl -s "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true" > /tmp/uat_bundle_android.js
    curl -s "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=web&dev=true" > /tmp/uat_bundle_web.js
    ```
  - **Resolution & Error Check**: Inspect output for `UnableToResolveError`, syntax errors, or missing modules. If found, **DO NOT surface the QR code**. Fix packages immediately.
  - **Screen Content & Static Text Verification**:
    - The agent must verify that the compiled bundle actually contains the root screen and static text expected from the UI mockups / contracts (e.g., verifying `app_root_viewport`, screen titles or key labels from mock data).
    - If expected static text or component definitions are missing, it indicates the entry router is serving an empty 404 touch stub or misconfigured directory structure. The agent must resolve route paths until the static text is verified in the bundle.

4. **Present Verified QR Code & Browser URL**:
  - Only after BOTH error-free compilation and static screen text are verified:
    - Generate QR code: `npx --yes qrcode "exp://<IP>:8081" -t png -o docs/expo-qr.png`.
    - Present the direct browser URL (`http://localhost:8081`), the Expo deep-link (`exp://<IP>:8081`), and the scannable QR code.

## Anti-Hallucination Rule
Never fake Android device runs. Prompt stakeholder to test scenarios in `docs/10_UAT_CHECKLIST.md`.
