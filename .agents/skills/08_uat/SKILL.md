---
name: uat
description: Phase 8 lead. Coordinates stakeholder acceptance in a target-platform test environment, records build-specific evidence, and manages feedback before Release.
---

# UAT Coordinator (Phase 8 Lead)

Follow Global Rules §8 for acceptance environments and evidence. Gate 3 records stakeholder acceptance; Gate 4 separately authorizes Release.

## Entry & Interactive Environment Selection
Start after all in-scope slices and aggregate Phase 7 QA pass, preserving any mock-only qualification. Read the contract, PRD, user stories, technical spec, and test manifest.

At Phase 8 entry, **prompt the user with the 4 UAT environment options**:

> *"Phase 7 QA is complete. Which UAT environment would you like to use for acceptance testing?"*
> 1. ⚡ **StackBlitz Web Sandbox** — Zero-setup in-browser WebContainer (Web/Vite projects).
> 2. 📱 **Expo / EAS Mobile Preview** — iOS / Android native testing via Expo Go QR code, simulator, or EAS internal build.
> 3. 💻 **Local Dev Server / Tunnel** — Rapid testing on `localhost` or via secure public tunnel (Cloudflare/ngrok).
> 4. ☁️ **Staging / Cloud Preview** — Deployment to a private staging URL (e.g. Vercel Preview, Netlify, or custom staging).

### Guided Follow-Up Based on User Selection:

1. **If Option 1 (StackBlitz):**
   - Read [StackBlitz reference](references/stackblitz-template.md).
   - Generate `open_stackblitz.html` and `redirect_stackblitz.html` targeting `https://stackblitz.com/run`.
   - Package required files, strictly excluding secrets and ignored env files.

2. **If Option 2 (Expo / EAS Mobile Preview):**
   - Read [Expo preview reference](references/expo-preview.md).
   - Ask user to choose: **(A) Expo Go** (instant QR code on iOS/Android camera) or **(B) EAS Internal Test Build**.
   - **Credentials & Env Safety:** Never request API keys, passwords, or signing certificates in chat. Instruct the user to create or populate their local `.env.local` (verified in `.gitignore` and never committed).
   - Guide authentication via CLI: `npx eas-cli login` or `npx expo login`.
   - Provide exact command: `npx expo start` (Expo Go) or `npx eas-cli build --profile preview` (EAS build).

3. **If Option 3 (Local Dev Server / Tunnel):**
   - Read [Local tunnel reference](references/local-tunnel.md).
   - Run `npm run dev` and provide `localhost:<port>`.
   - If mobile or remote testing is needed, provide the Cloudflare/ngrok tunnel command.

4. **If Option 4 (Staging / Cloud Preview):**
   - Read [Staging preview reference](references/staging-preview.md).
   - Ask for the existing staging URL or run `npx vercel` to generate a preview deployment.
   - Verify connection against staging/test data (never production data).

---

## Acceptance & Feedback
1. Reuse acceptance scenarios defined in Phase 2; refine them for the actual environment and applicable NFRs.
2. Record `source revision/build | platform/device/OS | environment | data mode (live/test/mocks) | AC/NFR-ID | expected/actual result | evidence | limitation` in `docs/10_UAT_CHECKLIST.md`.
3. Set `[AWAITING UAT SIGN-OFF]` and present the test access and checklist to the stakeholder. Record approver, decision, revision, and scope. Untested required behavior cannot count as accepted.
4. On revisions, write `UAT_FEEDBACK.md` with reproduction steps, expected/actual behavior, severity, and affected AC/NFR IDs; route through PM to the responsible lead, then rerun affected QA/regressions and UAT.
5. On acceptance, hand off to Release. Mock-demo acceptance stays qualified and cannot authorize production with required integrations unverified. Changed builds or environments require impact review and renewed affected evidence/sign-off.

---

## Deliverables
- `docs/10_UAT_CHECKLIST.md`: scenarios, tested build/environment, results, limitations, and stakeholder decision.
- `docs/progress.html`: selected environment access and pending/accepted scope.
- `UAT_FEEDBACK.md`: only when revisions are requested.
- `open_stackblitz.html` / `redirect_stackblitz.html`: only when StackBlitz option is selected.
