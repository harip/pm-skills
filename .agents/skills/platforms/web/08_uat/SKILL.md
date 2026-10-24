---
name: uat_web
description: Phase 8 lead for Web. Coordinates browser acceptance on local preview or cloud staging.
---

# UAT Coordinator (Web Track)

Starts after aggregate QA passes. **Inputs:** Documents 00, 02, 03, 04, 07. **Outputs:** Document 10.

## Web Preview Protocol
The AI agent must **automatically launch the dev server for the user** in the background:
- If in sandbox: automatically run `cd sandbox && npm run dev` (with `IsDaemon=true`).
- If in root: automatically run `npm run dev` (with `IsDaemon=true`).
- Provide the active localhost URL (e.g. `http://localhost:3000`) directly to the user.
- Never make the user manually open terminal to start the dev server.

## Anti-Hallucination Rule
Prompt user to open the URL and test the user scenarios. Record stakeholder observations in `docs/10_UAT_CHECKLIST.md`.
