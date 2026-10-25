---
name: uat_ios
description: Phase 8 lead for iOS. Coordinates real stakeholder acceptance via direct physical iPhone native installation or Expo Go/Simulator preview.
---

# UAT Coordinator (iOS Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10; environment link in `docs/progress-data.js`.

---

## 1. Physical iPhone Hook-In & Native Device Installation (Primary Track)

When the stakeholder or project targets iOS native execution (e.g. LiDAR, Camera, AR, or standalone app testing without Expo Go), the UAT Coordinator must guide, build, install, and verify the app directly on the connected hardware iPhone:

### Step 1: Mandatory Physical iPhone Hook-In Prompt & Stop Gate
1. **Unconditional Stakeholder Prompt (Always Ask & Wait)**:
   Whenever entering Phase 8 UAT on the iOS track, the UAT Coordinator MUST output a dedicated, prominent physical iPhone connection prompt to the stakeholder and **HALT AND WAIT**:
   > *"📱 **Physical iPhone Connection Required**: Please connect your physical iPhone to this Mac via USB cable, unlock the screen, ensure Developer Mode is enabled (**Settings > Privacy & Security > Developer Mode**), and tap 'Trust This Computer' if prompted.*
   > 
   > *Once your iPhone is connected via USB and unlocked, reply **`connected`** in chat to proceed with native device installation (or reply **`skip`** if you prefer testing exclusively via desktop browser or simulator)."*
2. **Hard Stop Enforcement**: The agent MUST STOP HERE and call no further tools. It is strictly forbidden to bypass this prompt or assume device presence without waiting for the user to reply `connected` or `skip`.
3. **Hardware Discovery (After User Confirms `connected`)**:
   - Query connected devices: `xcrun devicectl list devices`.
   - Verify that a physical hardware device is connected and in state `available (paired)`.
   - If no physical iPhone is detected or state is not `available (paired)`, re-prompt the user immediately to check the USB cable connection, unlock the screen, and confirm the Trust dialog, and wait.
   - Extract:
     - Device Name (e.g. `Nanose`)
     - Hardware Model (e.g. `iPhone 17 Pro Max / iPhone18,2`)
     - Identifier / UDID (e.g. `00008150-001A25222205401C`)
     - iOS Version (e.g. `27.0`)

### Step 2: Apple Signing Identity Detection
1. Query available developer certificates: `security find-identity -v -p codesigning`.
2. Extract the active `Apple Development: Name (TeamID)` identity and Team ID.
3. Ensure `ios/<ProjectName>.xcodeproj/project.pbxproj` is configured with `CODE_SIGN_STYLE = Automatic;`, `DEVELOPMENT_TEAM = <TeamID>;`, and a valid unique `PRODUCT_BUNDLE_IDENTIFIER`.

### Step 3: Native Prebuild & Workspace Hardening
1. Run `npx expo prebuild --platform ios` and `pod install` in `ios/`.
2. **Space-Proof Script Phases**: If the workspace path contains spaces, quote variables in build scripts (e.g., `basename "$PROJECT_DIR"` in `get-app-config-ios.sh`, quote `$NODE_BINARY` script wrappers in `project.pbxproj`).
3. **Deployment Target**: Ensure `IPHONEOS_DEPLOYMENT_TARGET` is set to minimum `16.0` across Pods and main project.

### Step 4: Mandatory iOS 27 / Xcode 27+ UIScene Lifecycle Verification
On iOS 27 / Xcode 27+, Apple strictly requires UIKit apps to adopt the `UIScene` lifecycle. Apps missing scene support crash immediately at launch with `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` (`SIGTRAP` / Signal 5).
- Ensure `Info.plist` declares `UIApplicationSceneManifest` pointing to `$(PRODUCT_MODULE_NAME).SceneDelegate`.
- Implement `SceneDelegate.swift` conforming to `UIWindowSceneDelegate` to bind the window and React Native Hermes runtime to the active `UIWindowScene`.
- Decouple window creation from `AppDelegate.swift`.
- Register `SceneDelegate.swift` in `PBXSourcesBuildPhase`.

### Step 5: Standalone Release Build & Direct Installation
1. Compile standalone Release binary with Hermes bytecode and assets embedded (no Metro dev server needed):
   ```bash
   cd ios && \
   xcodebuild -workspace <AppName>.xcworkspace \
     -scheme <AppName> \
     -configuration Release \
     -destination "id=<DEVICE_UDID>" \
     -allowProvisioningUpdates \
     -derivedDataPath /tmp/<AppName>DerivedData \
     build
   ```
2. Install directly to hardware:
   ```bash
   xcrun devicectl device install app --device <DEVICE_UDID> /tmp/<AppName>DerivedData/Build/Products/Release-iphoneos/<AppName>.app
   ```

### Step 6: Launch & Mandatory Autonomous Crash-Healing Loop
1. **Launch the App**:
   ```bash
   xcrun devicectl device process launch --device <DEVICE_UDID> --terminate-existing <BUNDLE_ID>
   ```
2. **Mandatory Live Process Verification Gate (DO NOT PRESENT TO USER IF NOT RUNNING)**:
   Wait 3–5 seconds after launch and inspect the live process list:
   ```bash
   xcrun devicectl device info processes --device <DEVICE_UDID> | grep -i "<AppName>"
   ```
   - **If the process is NOT found or exited immediately**:
     The agent MUST NOT declare success or present the app to the user yet.
     The agent MUST execute the automated crash diagnosis loop:
     1. Search crash logs on device:
        ```bash
        xcrun devicectl device info files --device <DEVICE_UDID> --domain-type systemCrashLogs --search <AppName>
        ```
     2. Copy and inspect the latest `.ips` file:
        ```bash
        xcrun devicectl device copy from --device <DEVICE_UDID> --domain-type systemCrashLogs --source "<LatestCrash>.ips" --destination /tmp/device_crash.ips
        ```
     3. Identify the failure reason (e.g. `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` on iOS 27 requiring `SceneDelegate`, missing `Info.plist` permissions, signing dylib mismatches).
     4. Apply the targeted code or configuration fix.
     5. Re-run `xcodebuild`, reinstall via `devicectl device install app`, and relaunch.
     6. **Loop continuously until `devicectl device info processes` confirms the app is actively running with a live PID in the foreground.**
3. **Only Once Confirmed Running**: Advance to Step 7 and prompt the stakeholder to verify the running app on their physical screen.

### Step 7: Stakeholder Guidance
- Provide clear instructions for first-time profile trust:
  - **Developer Mode**: On iOS 16+, ensure **Settings > Privacy & Security > Developer Mode** is ON.
  - **Untrusted Developer**: Go to **Settings > General > VPN & Device Management > Tap Developer Name > Tap Trust**.

---

## 2. Expo Go / Simulator Preview Protocol (Alternative Route)

When a physical iPhone is not available or rapid web/Expo preview is requested:

> **CRITICAL RULE**: Using `curl` on `entry.bundle` alone is **STRICTLY FORBIDDEN** as proof that a screen loads. You MUST execute the app in a real headless browser (`playwright`) and inspect `await page.innerText('body')` and `pageerror`.

1. **Clean Stale Ports & Launch Metro**:
   - Kill stale processes on ports `8081` and `8082`: `kill -9 $(lsof -ti :8081 -ti :8082) 2>/dev/null || true`.
   - Run `cd sandbox && CI=1 npx expo start -c --port 8081` (with `IsDaemon=true`).
   - Wait for endpoint `http://localhost:8081` to return HTTP 200.

2. **Mandatory Headless Browser Runtime Render Gate (Playwright WebKit)**:
   - Launch a real headless browser (`webkit` via `playwright`) against `http://localhost:8081`.
   - **Hard Assertions (Zero-Tolerance Gate)**:
     - `runtimeErrors` MUST be empty (`[]`).
     - `bodyText` MUST NOT be empty (`""`).
     - `bodyText` MUST NOT contain RedBox / ErrorOverlay strings (`Cannot read properties`, `UnableToResolveError`, `Component Stack`, `Call Stack`, `Render Error`).
     - `bodyText` MUST visibly contain the expected static text from the mockups.
   - If any assertion fails, **DO NOT surface the QR code or URL**. Fix the component code, restart Metro, and re-run Playwright until 100% green.

3. **Present Verified QR Code & Deep-Link**:
   - Generate QR code: `npx --yes qrcode "exp://<LAN_IP>:8081" -t png -o docs/expo-qr.png`.
   - Present browser URL (`http://localhost:8081`), Expo link (`exp://<LAN_IP>:8081`), and scannable QR code image.

---

## 3. Mandatory UAT Stop Protocol & Hard Gate (STOP EXECUTION HERE)

The AI agent must **NEVER simulate, fabricate, or bypass live stakeholder UAT**. It is **STRICTLY FORBIDDEN** to advance to Phase 9 Release or declare the workflow complete during Phase 8.

### Mandatory Stop Actions:
1. **Record Scenarios as Pending Stakeholder Run**:
   - In `docs/10_UAT_CHECKLIST.md`, mark all scenarios as `[AWAITING STAKEHOLDER MANUAL RUN]`.
2. **Present the Verified Live Target & Scenarios to User**:
   - Output the running endpoints (Physical iPhone running status + PID, or Expo Go QR code / deep-link, or Web preview URL).
   - Display the key UAT scenarios directly in chat so the stakeholder knows exactly what to test.
3. **Output the Explicit Stop Gate Prompt**:
   You MUST end your response with this exact prompt:
   > ### 🛑 Phase 8 UAT Verification Required
   > The application is verified running live on your **[physical iPhone / iOS Simulator / Browser preview]**.
   > Please perform acceptance testing on your screen according to the scenarios in `docs/10_UAT_CHECKLIST.md`.
   > 
   > **How to proceed:**
   > - Reply with any bug reports or UI/functional feedback (the swarm will automatically fix them, recompile, and re-present for verification).
   > - Or reply **`approved`** to accept UAT and advance to Phase 9 (Release).
4. **Update Project Tracking**:
   - In `docs/PROJECT_STATUS.md`: Set `Phase 8 UAT — platforms/ios/08_uat — [AWAITING STAKEHOLDER UAT APPROVAL]`.
   - Set `NEXT_STEP_POINTER: AWAITING USER — Reply 'approved' to advance to Phase 9 (Release) or reply with test findings.`
5. **HALT EXECUTION IMMEDIATELY**:
   - Call NO further tools.
   - Do NOT execute Phase 9 (`09_deployment`).
   - Yield control and wait for the user's explicit reply.
