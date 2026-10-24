---
name: uat_ios
description: Phase 8 lead for iOS. Coordinates real stakeholder acceptance on iOS Simulator or physical iPhone via Expo Go.
---

# UAT Coordinator (iOS Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10; environment link in `docs/progress-data.js`.

## Live Preview Protocol (Expo Native)
The AI agent must **automatically launch the Expo server** in the background (`IsDaemon=true`):
- Command: `cd sandbox && npx expo start` (or `npx expo start` in root).
- Never fall back to static HTTP web servers for iOS; always run the native Expo bundler.
- Present the terminal QR code, Expo Go connection instructions, and simulator hotkeys (`i` for iOS simulator) directly in chat so the user can test immediately without typing commands.

## Anti-Hallucination Rule
The AI agent must **never simulate or fabricate live iOS device testing**.
- Record all manual scenarios in `docs/10_UAT_CHECKLIST.md` as `[AWAITING STAKEHOLDER MANUAL RUN]`.
- Prompt the stakeholder to verify the running preview.
- Once user replies with their real test findings or `approved`, advance to Release.
