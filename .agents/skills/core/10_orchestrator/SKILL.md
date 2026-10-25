---
name: orchestrator
description: State engine. Rewrites docs/PROJECT_STATUS.md and docs/progress-data.js every turn for cold-start resumption, platform track routing, and the interactive dashboard.
---

# Orchestrator (State & Interactive Dashboard Engine)

## Dynamic Workspace & Sandbox Routing
- If in test mode (`is_test_sandbox: true` in Doc 00, or `/pm test`), all paths are relative to `sandbox/` (e.g. `sandbox/docs/PROJECT_STATUS.md`, `sandbox/docs/progress-data.js`, `sandbox/docs/00_DISCOVERY_ANSWERS.json`).
- Otherwise, paths are relative to workspace root (`docs/`).

## Streamlined Gate Policy (Always Stop at Phase 1 Discovery & Phase 8 UAT)
1. **Phase 1 Interactive Discovery & Mockups (`01_it_consultant`)**: Always stop so the user can review the interactive screen mockups (`scr_001`..`scr_00N`), toggle AI-suggested features, answer the 8–12 discovery questions in `docs/progress.html`, and click Save (`docs/00_DISCOVERY_ANSWERS.json`).
2. **Autonomous Execution Pipeline (Phases 2 → 3 → 4 → Parallel [Phase 5 UI || Phase 6 Services] → Phase 7 QA)**: Once `docs/00_DISCOVERY_ANSWERS.json` is submitted (`submitted` / `approved`), advance automatically from Phase 1 Contract/Brief through Phase 7 QA & Playwright WebKit verification without pausing for intermediate approvals.
3. **Phase 8 Live UAT (`08_uat`) Hard Stop**: The workflow **MUST ALWAYS STOP** at Phase 8 UAT. When `platform: ios`, the agent MUST unconditionally prompt the user: *"Please connect your physical iPhone to this Mac via USB cable, unlock the screen, ensure Developer Mode is enabled, and tap 'Trust This Computer' if prompted. Once connected, reply 'connected' in chat (or 'skip' to test via browser/simulator)."* and **HALT AND WAIT** for user confirmation before proceeding with native installation. Once the app is running on device or browser, present the UAT checklist, prompt the user for their real test findings or `approved`, set `NEXT_STEP_POINTER: AWAITING USER — Reply 'approved' to advance to Phase 9 (Release) or reply with test findings`, and halt execution immediately. It is **strictly forbidden** to advance to Phase 9 Release or declare the workflow complete during Phase 8.
4. **Go-Back & Edit Support**: Always preserve `window.PM_DATA.consultantDiscovery` in `docs/progress-data.js` across every turn so the user can return to the **`💼 IT Consultant Questionnaire`** tab in `docs/progress.html` at any time, modify answers, and re-save `docs/00_DISCOVERY_ANSWERS.json`.

## Dynamic Platform Pointer Routing
When setting `NEXT_STEP_POINTER`:
- Read `platform` (`ios`, `android`, or `web`) from Document 00.
- For Phases 3, 5, 6, 7, 8, Release: point directly to `.agents/skills/platforms/${platform}/${skill}`.
- For Phases 1, 2, 4, State, Audit: point to `.agents/skills/core/${skill}`.
- Explicitly instruct the agent to **load ONLY the skill specified in the pointer** and never inspect other platform directories.

## Parallel Subagent Dispatch Engine (Phase 5 & 6)
Immediately after Phase 4 Schemas & Scaffolding (`npx tsc --noEmit` exit 0) complete:
1. Do NOT pause for a separate mockup gate (mockups were already approved in Phase 1) and do NOT execute Phase 5 and Phase 6 sequentially.
2. Dispatch both workers concurrently using `invoke_subagent`:
   - `invoke_subagent(TypeName="self", Role="Frontend UI Engineer", Prompt="Execute Phase 5: Read platforms/<platform>/05_frontend_developer. Write docs/06_DESIGN_REGISTER.md and build the production component tree matching the approved Phase 1 mockups in docs/design/mockups/, verify compilation (npx tsc --noEmit), and return completion report.")`
   - `invoke_subagent(TypeName="self", Role="Database & Service Engineer", Prompt="Execute Phase 6: Read platforms/<platform>/06_service_engineer. Configure SQLite/DB schemas, write services/hooks, verify compilation (npx tsc --noEmit), and return completion report.")`
3. Record both subagent conversation IDs in `docs/PROJECT_STATUS.md`.
4. Wait for messages from both subagents (Reactive Wakeup).
5. When both report green build exit code 0:
   - Run Architecture Reviewer audit on combined output.
   - Advance immediately to Phase 7 QA (`platforms/<platform>/07_qa_agent`).

## Every Turn (silent; never dump state into chat)
1. Rewrite `docs/PROJECT_STATUS.md` (≤65 lines; keep the last 3 session rows).
2. Rewrite `docs/progress-data.js`, following the schema in `assets/progress-data.sample.js` (always preserving `consultantDiscovery`).
3. If `docs/progress.html`, `docs/progress.min.js`, or `docs/discovery-answers.js` is missing, copy them from `.agents/skills/core/10_orchestrator/assets/` with `cp`.

## `docs/PROJECT_STATUS.md`
```markdown
# PROJECT STATUS — [Project]
**Platform:** [IOS|ANDROID|WEB] | **Updated:** [ISO 8601]
### 🎯 NEXT_STEP_POINTER: .agents/skills/[core|platforms/<platform>]/[skill] — [Agent] to [action]. [Execute immediately | Awaiting user]

## Phases
- [ ] Phase 1 Discovery & Mockups — core/01_it_consultant — [status]
- [ ] Phase 2 Scope — core/02_product_owner — [status]
- [ ] Phase 3 Tech Spec — platforms/<platform>/03_technical_architect — [status]
- [ ] Phase 4 Schemas — core/04_content_parser — [status]
- [ ] Phase 5 UI — platforms/<platform>/05_frontend_developer — [status]
- [ ] Phase 6 Services — platforms/<platform>/06_service_engineer — [status]
- [ ] Phase 7 QA — platforms/<platform>/07_qa_agent — [status]
- [ ] Phase 8 UAT — platforms/<platform>/08_uat — [status]
- [ ] Release — platforms/<platform>/09_deployment — [status]

## Sessions (last 3)
| # | Date | Completed | Ended at |
```
