---
name: uat_android
description: Phase 8 lead for Android. Coordinates real stakeholder acceptance on Android Emulator or physical device via Expo Go.
---

# UAT Coordinator (Android Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10.

## Live Preview Protocol (Expo Native Auto-Launch & Headless Runtime Gate)
The AI agent must **execute the live app in a real headless browser and verify rendered DOM text with zero runtime errors BEFORE presenting the QR code or URL to the user**:

> **CRITICAL RULE**: Using `curl` on `entry.bundle` alone is **STRICTLY FORBIDDEN** as proof that a screen loads. `curl` only downloads raw unexecuted JavaScript text and completely misses runtime React crashes (such as `Cannot read properties of undefined`). You MUST execute the app in a real headless browser (`playwright`) and inspect `await page.innerText('body')` and `pageerror`.

1. **Expo Account Verification**: Run `npx expo whoami`.
   - If not logged in, prompt user to run `npx expo login` or supply `EXPO_TOKEN`.

2. **Clean Stale Ports & Launch Metro Bundler**:
   - Kill any stale processes on ports `8081` and `8082`: `kill -9 $(lsof -ti :8081 -ti :8082) 2>/dev/null || true`.
   - Run `cd sandbox && CI=1 npx expo start -c --port 8081` (with `IsDaemon=true`).
   - Wait for endpoint `http://localhost:8081` to return HTTP 200.

3. **Verify Native Android Manifest & Hermes Bundle Endpoint**:
   - Fetch the Android manifest: `curl -s -H "expo-platform: android" http://<LAN_IP>:8081/`.
   - Request the exact `launchAsset.url` from the manifest and verify it returns HTTP 200 without `UnableToResolveError`.

4. **Mandatory Headless Browser Runtime Render & Static Text Gate (Playwright)**:
   - Launch a real headless browser (`webkit` or `chromium` via `playwright`) against `http://localhost:8081`, capture `pageerror` and `console.error`, and read `await page.innerText('body')`.
   - **Hard Assertions**:
     - `runtimeErrors` MUST be empty (`[]`).
     - `bodyText` MUST NOT be empty and MUST NOT contain RedBox / ErrorOverlay strings (`Cannot read properties`, `UnableToResolveError`, `Component Stack`, `Call Stack`).
     - `bodyText` MUST visibly contain the expected static text from the landing screen and mockups across all inventory screens.
   - If any assertion fails, **DO NOT surface the QR code or URL**. Fix the component code and re-run Playwright until 100% green.

5. **Present Verified QR Code & Browser URL**:
   - Only after Playwright proves the live DOM renders the expected static text with `runtimeErrors: []`, generate the QR code (`npx --yes qrcode "exp://<LAN_IP>:8081" -t png -o docs/expo-qr.png`) and present the links.

## Mandatory UAT Stop Protocol & Hard Gate (STOP EXECUTION HERE)

The AI agent must **NEVER simulate, fabricate, or bypass live stakeholder UAT**. It is **STRICTLY FORBIDDEN** to advance to Phase 9 Release or declare the workflow complete during Phase 8.

### Mandatory Stop Actions:
1. **Record Scenarios as Pending Stakeholder Run**:
   - In `docs/10_UAT_CHECKLIST.md`, mark all scenarios as `[AWAITING STAKEHOLDER MANUAL RUN]`.
2. **Present the Verified Live Target & Scenarios to User**:
   - Output the running endpoints (Android device/emulator status, Expo Go QR code, or browser preview URL).
   - Display the key UAT scenarios directly in chat so the stakeholder knows exactly what to test.
3. **Output the Explicit Stop Gate Prompt**:
   You MUST end your response with this exact prompt:
   > ### 🛑 Phase 8 UAT Verification Required
   > The application is verified running live on your **[Android Device / Emulator / Browser preview]**.
   > Please perform acceptance testing on your screen according to the scenarios in `docs/10_UAT_CHECKLIST.md`.
   > 
   > **How to proceed:**
   > - Reply with any bug reports or UI/functional feedback (the swarm will automatically fix them, recompile, and re-present for verification).
   > - Or reply **`approved`** to accept UAT and advance to Phase 9 (Release).
4. **Update Project Tracking**:
   - In `docs/PROJECT_STATUS.md`: Set `Phase 8 UAT — platforms/android/08_uat — [AWAITING STAKEHOLDER UAT APPROVAL]`.
   - Set `NEXT_STEP_POINTER: AWAITING USER — Reply 'approved' to advance to Phase 9 (Release) or reply with test findings.`
5. **HALT EXECUTION IMMEDIATELY**:
   - Call NO further tools.
   - Do NOT execute Phase 9 (`09_deployment`).
   - Yield control and wait for the user's explicit reply.
