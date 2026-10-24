---
name: uat_ios
description: Phase 8 lead for iOS. Coordinates real stakeholder acceptance on iOS Simulator or physical iPhone via Expo Go.
---

# UAT Coordinator (iOS Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10; environment link in `docs/progress-data.js`.

## Live Preview Protocol (Expo Native Auto-Launch & Headless Runtime Gate)
The AI agent must **execute the live app in a real headless browser and verify rendered DOM text with zero runtime errors BEFORE presenting the QR code or URL to the user**:

> **CRITICAL RULE**: Using `curl` on `entry.bundle` alone is **STRICTLY FORBIDDEN** as proof that a screen loads. `curl` only downloads raw unexecuted JavaScript text and completely misses runtime React crashes (such as `Cannot read properties of undefined (reading 'PathBuilder')`). You MUST execute the app in a real headless browser (`playwright`) and inspect `await page.innerText('body')` and `pageerror`.

1. **Expo Account Verification**: Run `npx expo whoami`.
   - If not logged in, prompt user to run `npx expo login` or supply `EXPO_TOKEN`.

2. **Clean Stale Ports & Launch Metro Bundler**:
   - Kill any stale processes on ports `8081` and `8082`: `kill -9 $(lsof -ti :8081 -ti :8082) 2>/dev/null || true`.
   - Run `cd sandbox && CI=1 npx expo start -c --port 8081` (with `IsDaemon=true`).
   - Wait for endpoint `http://localhost:8081` to return HTTP 200.

3. **Verify Native iOS Manifest & Hermes Bundle Endpoint**:
   - Fetch the iOS manifest: `curl -s -H "expo-platform: ios" http://<LAN_IP>:8081/`.
   - Request the exact `launchAsset.url` from the manifest and verify it returns HTTP 200 without `UnableToResolveError`.

4. **Mandatory Headless Browser Runtime Render & Static Text Gate (Playwright)**:
   - Launch a real headless browser (`webkit` or `chromium` via `playwright`) against `http://localhost:8081`:
     ```js
     const { webkit } = require('playwright');
     const browser = await webkit.launch({ headless: true });
     const page = await browser.newPage();
     const runtimeErrors = [];
     page.on('pageerror', err => runtimeErrors.push(err.message));
     page.on('console', msg => { if (msg.type() === 'error') runtimeErrors.push(msg.text()); });
     await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 30000 });
     const bodyText = await page.innerText('body');
     ```
   - **Hard Assertions (Zero-Tolerance Gate)**:
     - `runtimeErrors` MUST be empty (`[]`).
     - `bodyText` MUST NOT be empty (`""`).
     - `bodyText` MUST NOT contain RedBox / ErrorOverlay strings (`Cannot read properties`, `UnableToResolveError`, `Component Stack`, `Call Stack`, `Render Error`).
     - `bodyText` MUST visibly contain the expected static text from the landing screen and mockups, and clicking through each screen in the inventory must render its expected static text cleanly.
   - If any assertion fails, **DO NOT surface the QR code or URL**. Fix the component code, restart Metro, and re-run Playwright until 100% green.

5. **Present Verified QR Code & Browser URL**:
   - Only after Playwright proves the live DOM renders the expected static text with `runtimeErrors: []`:
     - Generate QR code: `npx --yes qrcode "exp://<LAN_IP>:8081" -t png -o docs/expo-qr.png`.
     - Present the direct browser URL (`http://localhost:8081`), the Expo deep-link (`exp://<LAN_IP>:8081`), and the scannable QR code.

## Anti-Hallucination Rule
The AI agent must **never simulate or fabricate live iOS device testing**.
- Record all manual scenarios in `docs/10_UAT_CHECKLIST.md` as `[AWAITING STAKEHOLDER MANUAL RUN]`.
- Prompt the stakeholder to verify the running preview.
- Once user replies with their real test findings or `approved`, advance to Release.
