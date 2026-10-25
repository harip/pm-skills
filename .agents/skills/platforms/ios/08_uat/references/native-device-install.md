# Physical iPhone Direct Native Install & Runtime Verification Protocol

Use this reference guide during **Phase 8 (UAT)** when installing, running, and verifying a standalone native iOS app directly on a physical iPhone.

---

## 1. Mandatory Physical iPhone Hook-in Prompt & Discovery

### Mandatory User Prompt (Always Prompt First & Wait)
Whenever entering Phase 8 UAT on iOS, always ask the user explicitly and **HALT AND WAIT**:
> *"📱 **Physical iPhone Connection Required**: Please connect your physical iPhone to this Mac via USB cable, unlock the screen, ensure Developer Mode is enabled (**Settings > Privacy & Security > Developer Mode**), and tap 'Trust This Computer' if prompted. Once connected, reply **`connected`** in chat to proceed (or **`skip`** to test via browser/simulator)."*

### Hardware Discovery (After User Confirms `connected`)
Run:
```bash
xcrun devicectl list devices
```

- Parse the output table for physical hardware devices with state `available (paired)`.
- If no physical iPhone is detected or state is `unpaired`, re-prompt the user to re-seat the USB cable, unlock the screen, and trust the host Mac.
- Extract:
  - **Device Name** (e.g. `Nanose`)
  - **UDID / Identifier** (e.g. `00008150-001A25222205401C`)
  - **OS Version & Model** (e.g. `iOS 27.0`, `iPhone 17 Pro Max`)

---

## 2. Apple Development Signing Identity Discovery

Query available code signing certificates in the macOS keychain:
```bash
security find-identity -v -p codesigning
```
- Extract the valid **Apple Development** identity (e.g. `"Apple Development: User Name (XXXXXXXXXX)"`).
- Extract the 10-character **Team ID** (`XXXXXXXXXX`).
- In `ios/<ProjectName>.xcodeproj/project.pbxproj`:
  - Set `CODE_SIGN_STYLE = Automatic;`
  - Set `DEVELOPMENT_TEAM = <TEAM_ID>;`
  - Set `PRODUCT_BUNDLE_IDENTIFIER = <BUNDLE_ID>;`

---

## 3. Path Space-Proofing & Build Hardening

When workspaces reside on volumes with spaces (e.g. `/Volumes/Samsung 990 1TB/...`), standard CocoaPods and Xcode shell phases will break if unquoted.

1. **Fix `get-app-config-ios.sh`**:
   In `node_modules/expo-constants/scripts/get-app-config-ios.sh`:
   ```bash
   # Ensure PROJECT_DIR is quoted:
   PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")
   ```
2. **Fix `Pods.xcodeproj` EXConstants Phase**:
   Replace:
   ```pbxproj
   shellScript = "bash -l -c \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"";
   ```
   with:
   ```pbxproj
   shellScript = "bash \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"";
   ```

3. **Fix `ios-configure-glog.sh` for Xcode Paths with Spaces**:
   When Xcode resides on a volume with spaces (e.g. `/Volumes/Samsung 990 1TB/...`), `glog` `./configure` breaks because `$CC` splits unquoted paths. Wrap compiler and SDK paths:
   ```bash
   ln -sfn "$(xcrun -sdk $PLATFORM_NAME --show-sdk-path)" /tmp/ios_sdk
   export CC="/tmp/ios_toolchain/cc -arch $CURRENT_ARCH -isysroot /tmp/ios_sdk"
   export CXX="/tmp/ios_toolchain/cxx -arch $CURRENT_ARCH -isysroot /tmp/ios_sdk"
   ```

4. **Fix ReactCodegen `Generate Specs` for Workspace Paths with Spaces**:
   In `node_modules/react-native/scripts/react_native_pods_utils/script_phases.rb` and `Pods.xcodeproj`:
   Quote `$WITH_ENVIRONMENT` and `$SCRIPT_PHASES_SCRIPT`:
   ```bash
   /bin/sh -c "\"$WITH_ENVIRONMENT\" \"$SCRIPT_PHASES_SCRIPT\""
   ```

5. **Fix `with-environment.sh` Execution for Paths with Spaces**:
   In `node_modules/react-native/scripts/xcode/with-environment.sh`:
   Quote argument execution:
   ```bash
   if [ -n "$1" ]; then
     "$@"
   fi
   ```
6. **Fix `fmt` Consteval C++20 Clang Incompatibility**:
   In Xcode 16/27 with modern Apple Clang, `fmt` fails compiling `format.cc` with `call to consteval function is not a constant expression`. Disable `FMT_USE_CONSTEVAL` in `Pods/fmt/include/fmt/base.h`:
   ```cpp
   #undef FMT_USE_CONSTEVAL
   #define FMT_USE_CONSTEVAL 0
   #define FMT_CONSTEVAL
   #define FMT_CONSTEXPR20
   ```
7. **Fix `RoomScanLiDARStudio.xcodeproj` Bundle Script Phase**:
   Ensure backtick expansions with spaces are wrapped in `bash "$(...)"`:
   ```pbxproj
   bash -c "\"$NODE_BINARY\" \"$($NODE_BINARY --print \"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\")\""
   ```
4. **Enforce Minimum Deployment Target**:
   Ensure `IPHONEOS_DEPLOYMENT_TARGET` is at least `16.0` across both `project.pbxproj` files to avoid symbol availability failures in modern Swift pods (e.g. `ExpoRouter`).

---

## 4. Mandatory iOS 27 / Xcode 27+ UIScene Lifecycle Adoption

On iOS 27 SDK (Xcode 27+), Apple strictly requires UIKit apps to adopt the `UIScene` lifecycle. If missing, the app crashes instantly upon launch with:
```
___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption (SIGTRAP / Signal 5)
```

### Fix Checklist:
1. **Declare Scene Manifest in `ios/<AppName>/Info.plist`**:
   ```xml
   <key>UIApplicationSceneManifest</key>
   <dict>
     <key>UIApplicationSupportsMultipleScenes</key>
     <false/>
     <key>UISceneConfigurations</key>
     <dict>
       <key>UIWindowSceneSessionRoleApplication</key>
       <array>
         <dict>
           <key>UISceneConfigurationName</key>
           <string>Default Configuration</string>
           <key>UISceneDelegateClassName</key>
           <string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
         </dict>
       </array>
     </dict>
   </dict>
   ```

2. **Add `SceneDelegate.swift`**:
   Create `ios/<AppName>/SceneDelegate.swift`:
   ```swift
   import UIKit
   import React

   class SceneDelegate: UIResponder, UIWindowSceneDelegate {
     var window: UIWindow?

     func scene(
       _ scene: UIScene,
       willConnectTo session: UISceneSession,
       options connectionOptions: UIScene.ConnectionOptions
     ) {
       guard let windowScene = scene as? UIWindowScene,
             let appDelegate = UIApplication.shared.delegate as? AppDelegate,
             let factory = appDelegate.reactNativeFactory else {
         return
       }

       let window = UIWindow(windowScene: windowScene)
       self.window = window
       appDelegate.window = window

       factory.startReactNative(
         withModuleName: "main",
         in: window,
         launchOptions: appDelegate.launchOptions
       )
     }

     func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
       guard let url = URLContexts.first?.url else { return }
       _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
     }
   }
   ```

3. **Update `AppDelegate.swift`**:
   - Store `launchOptions: [UIApplication.LaunchOptionsKey: Any]?`.
   - Remove window initialization and `factory.startReactNative` from `didFinishLaunchingWithOptions`, leaving window creation to `SceneDelegate`.

4. **Register `SceneDelegate.swift` in Xcode Project**:
   - Add build file entry to `PBXBuildFile`.
   - Add file reference to `PBXFileReference`.
   - Add reference to the main group children.
   - Add to `PBXSourcesBuildPhase`.

---

## 5. Standalone Release Build & Direct Installation

1. **Compile Standalone Release Binary**:
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

2. **Direct Hardware Install**:
   ```bash
   xcrun devicectl device install app --device <DEVICE_UDID> /tmp/<AppName>DerivedData/Build/Products/Release-iphoneos/<AppName>.app
   ```

---

## 6. Launch & Automated Crash Diagnostics / Healing Loop

1. **Launch with Console Attached**:
   ```bash
   xcrun devicectl device process launch --device <DEVICE_UDID> --terminate-existing --console <BUNDLE_ID>
   ```
2. **If App Terminates Early (Signal 5, Signal 6, etc.)**:
   - Locate the crash report on the device:
     ```bash
     xcrun devicectl device info files --device <DEVICE_UDID> --domain-type systemCrashLogs --search <AppName>
     ```
   - Copy the `.ips` report to the Mac:
     ```bash
     xcrun devicectl device copy from --device <DEVICE_UDID> --domain-type systemCrashLogs --source "<LatestCrash>.ips" --destination /tmp/device_crash.ips
     ```
   - Parse the crash report JSON:
     - Check `faultingThread` stack trace and symbols (e.g. missing scene delegate, missing Info.plist permission keys like `NSCameraUsageDescription`, missing font/asset, or library linking failure).
   - Apply the targeted code or project fix.
   - Incrementally re-compile (`xcodebuild`), re-install, and re-launch.
   - Repeat until the process runs continuously without crashing.

3. **Verify Active Foreground Process**:
   ```bash
   xcrun devicectl device info processes --device <DEVICE_UDID> | grep -i "<AppName>"
   ```
   Confirm console logs contain Hermes / React Native evaluation:
   ```
   ReactInstance: evaluateJavaScript() with JS bundle
   ```

---

## 7. Stakeholder Guidance Checklist

When handing off the running native build to the user, include guidance for:
1. **Developer Mode**: On iOS 16+, verify **Settings > Privacy & Security > Developer Mode** is ON (requires one restart).
2. **Trusting Developer Profile**: On first run of a locally signed certificate, go to **Settings > General > VPN & Device Management > Tap Developer Name > Tap Trust**.
3. **Record Findings**: Log the successful device run in `docs/10_UAT_CHECKLIST.md`.
