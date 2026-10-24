---
name: uat_ios
description: Phase 8 lead for iOS. Coordinates real stakeholder acceptance on iOS Simulator or physical iPhone via Expo Go.
---

# UAT Coordinator (iOS Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10; environment link in `docs/progress-data.js`.

## Live Preview Protocol (Expo Native Auto-Launch)
The AI agent must **automatically launch the native Expo Metro bundler** in the background as a daemon process:
- **Expo Account Verification**: Run `npx expo whoami`.
  - If not logged in, prompt the user with interactive steps:
    1. "You need to log into your Expo CLI to pair with Expo Go on your iPhone."
    2. Instruct user to run `npx expo login` or provide `EXPO_TOKEN`.
    3. Once logged in, rerun bundler with `npx expo start --go --lan`.
- Launch command: `cd sandbox && CI=1 npx expo start --go --lan` (or in root for production runs).
- Verified endpoint: `http://localhost:8081` (returns HTTP 200 OK).
- The agent must generate a scannable QR code image for the user using `npx --yes qrcode "exp://<IP>:8081" -t png -o docs/expo-qr.png`.
- The agent presents the direct `exp://` deep-link and instructions to open on a physical iPhone via **Expo Go**. Never ask the user to open terminal or run commands unless an interactive auth action like `npx expo login` is required.

## Anti-Hallucination Rule
The AI agent must **never simulate or fabricate live iOS device testing**.
- Record all manual scenarios in `docs/10_UAT_CHECKLIST.md` as `[AWAITING STAKEHOLDER MANUAL RUN]`.
- Prompt the stakeholder to verify the running preview.
- Once user replies with their real test findings or `approved`, advance to Release.
