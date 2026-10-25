---
name: uat_ios
description: Phase 8 lead for iOS. Coordinates real stakeholder acceptance via direct physical iPhone native installation or Expo Go/Simulator preview.
---

# UAT Coordinator (iOS Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10; environment link in `docs/progress-data.js`.

---

## 1. Physical iPhone Hook-In & Native Device Installation (Primary Track)

When the stakeholder or project targets iOS native execution (e.g. LiDAR, Camera, AR, or standalone app testing without Expo Go), the UAT Coordinator must guide, build, install, and verify the app directly on the connected hardware iPhone:

### Step 1: Device Detection & Hook-In Prompt
1. Query connected devices via `xcrun devicectl list devices`.
2. **If no physical device is connected or state is not `available (paired)`**:
   - Prompt the user immediately:
     > *"Please connect your physical iPhone to this Mac via USB cable, unlock the screen, and tap 'Trust This Computer' if prompted."*
   - Re-check `xcrun devicectl list devices` until a paired hardware device is found.
3. Extract:
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

### Step 6: Launch & Automated Crash Diagnosis / Healing Loop
1. Launch the app with console attached:
   ```bash
   xcrun devicectl device process launch --device <DEVICE_UDID> --terminate-existing --console <BUNDLE_ID>
   ```
2. **If the app exits prematurely or crashes**:
   - Query system crash logs from the device:
     ```bash
     xcrun devicectl device info files --device <DEVICE_UDID> --domain-type systemCrashLogs --search <AppName>
     ```
   - Copy the latest `.ips` crash file to the Mac:
     ```bash
     xcrun devicectl device copy from --device <DEVICE_UDID> --domain-type systemCrashLogs --source "<CrashFile>.ips" --destination /tmp/device_crash.ips
     ```
   - Parse the crash report to pinpoint the exact failure (e.g., missing privacy permission keys in `Info.plist`, unhandled runtime exceptions, dynamic library loading errors).
   - Apply the targeted fix, recompile, reinstall, and relaunch.
   - **Repeat until the app process stays running continuously in the foreground without crashing.**

3. **Verify Active Execution**:
   - Check process list: `xcrun devicectl device info processes --device <DEVICE_UDID> | grep -i "<AppName>"`.
   - Confirm console logs show JavaScript engine startup (e.g., Hermes `evaluateJavaScript() with JS bundle`).

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

## 3. Anti-Hallucination Rule
The AI agent must **never simulate or fabricate live iOS device testing**.
- Record all manual scenarios in `docs/10_UAT_CHECKLIST.md` as `[AWAITING STAKEHOLDER MANUAL RUN]`.
- Prompt the stakeholder to verify the running app on their physical iPhone screen or simulator preview.
- Once the user replies with their real test findings or `approved`, advance to Release.
