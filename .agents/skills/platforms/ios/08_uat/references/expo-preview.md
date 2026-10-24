# Expo & EAS Mobile Preview Reference for UAT

Use this reference when the stakeholder or developer selects **Option 2: Expo / EAS Mobile Preview** for iOS or Android acceptance testing.

---

## 1. Safety & Credential Protocol (Zero-Leak Guarantee)

> [!CAUTION]
> **NEVER ask for passwords, private API keys, Apple ID credentials, or signing certificates directly in chat.**

When setting up Expo for UAT:
1. **Local Environment Variables:**
   - Instruct the user to create or update `.env.local` in the project root:
     ```bash
     touch .env.local
     ```
   - Explicitly remind them:
     > *"Ensure `.env.local` is listed in `.gitignore` (verified). Never commit secrets to Git."*
   - List the required non-secret variable names they need to set (e.g. `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
2. **Provider Authentication:**
   - Guide the user to authenticate through the official CLI directly in their terminal:
     ```bash
     npx eas-cli login
     # or
     npx expo login
     ```
   - Verify connection safely:
     ```bash
     npx eas-cli whoami
     ```

---

## 2. Interactive Selection: Choose the Mobile Testing Target

Present the user with the two primary mobile testing routes:

### Route A: Expo Go (Instant QR Code Testing — Recommended for Rapid Iteration)
Ideal when native third-party libraries requiring custom native code (bare plugins) are not strictly needed:
1. Check dependencies for incompatible native modules.
2. Provide the startup command:
   ```bash
   npx expo start
   ```
3. Guide the user:
   - **iOS:** Open the native Camera app on an iPhone and scan the terminal QR code. This will open the build inside the **Expo Go** app from the App Store.
   - **Android:** Open the Expo Go app and tap "Scan QR Code".
   - **Simulator:** Press `i` in the terminal for iOS Simulator or `a` for Android Emulator.

---

### Route B: EAS Internal Test Build (True Native Binary Testing)
Required when testing push notifications, deep links, custom native pods, or hardware APIs that Expo Go cannot execute:
1. Verify `eas.json` has a `preview` profile configured:
   ```json
   {
     "build": {
       "preview": {
         "distribution": "internal"
       }
     }
   }
   ```
2. For iOS Ad-Hoc / Internal distribution, ensure test devices (UDIDs) are registered via:
   ```bash
   npx eas-cli device:create
   ```
3. Trigger the preview build:
   ```bash
   npx eas-cli build --platform ios --profile preview
   ```
4. Provide the generated Expo build dashboard URL and installable QR code link to the user.

---

## 3. UAT Evidence & Checklist Recording

Once the user accesses the build:
1. Record in `docs/10_UAT_CHECKLIST.md`:
   - **Platform & OS:** (e.g., iPhone 15 Pro, iOS 18.1)
   - **Environment:** Expo Go (SDK 52) or EAS Build ID (`eas-build-xxxx`)
   - **Data Mode:** Test API / Mocks / Staging Supabase
2. Update `docs/progress.html` with the mobile testing link or build status.
