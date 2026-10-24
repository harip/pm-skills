---
name: uat_android
description: Phase 8 lead for Android. Coordinates real stakeholder acceptance on Android Emulator or physical device via Expo Go.
---

# UAT Coordinator (Android Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10.

## Live Preview Protocol
The AI agent must **automatically launch the dev server for the user** in the background:
- If in sandbox: automatically run `cd sandbox && npx expo start` (with `IsDaemon=true`).
- If in root: automatically run `npx expo start` (with `IsDaemon=true`).
- Present QR code and Android instructions directly in chat without requiring manual user terminal input.

## Anti-Hallucination Rule
Never fake Android device runs. Prompt stakeholder to test scenarios in `docs/10_UAT_CHECKLIST.md`.
