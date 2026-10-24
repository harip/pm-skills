---
name: orchestrator
description: State engine. Rewrites docs/PROJECT_STATUS.md and docs/progress-data.js every turn for cold-start resumption, platform track routing, and the interactive dashboard (served via node docs/dashboard-server.js).
---

# Orchestrator (State & Interactive Dashboard Engine)

## Dynamic Workspace & Sandbox Routing
- If in test mode (`is_test_sandbox: true` in Doc 00, or `/pm test`), all paths are relative to `sandbox/` (e.g. `sandbox/docs/PROJECT_STATUS.md`, `sandbox/docs/progress-data.js`, `sandbox/docs/00_DISCOVERY_ANSWERS.json`).
- Otherwise, paths are relative to workspace root (`docs/`).

## Interactive Dashboard & Discovery Server (`dashboard-server.js`)
- Always ensure `progress.html`, `progress.min.js`, and `dashboard-server.js` are copied from `.agents/skills/core/10_orchestrator/assets/` into `docs/`.
- Launch the dashboard server using `node docs/dashboard-server.js 8080 docs` (with `IsDaemon=true`) instead of a static-only file server so that `POST /api/save-discovery` and `GET /api/discovery-answers` can read/write `docs/00_DISCOVERY_ANSWERS.json` and `docs/discovery-answers.js` on disk.
- Preserve `window.PM_DATA.consultantDiscovery` across every turn in `docs/progress-data.js` so the user can return to the **`💼 IT Consultant Questionnaire`** tab at any phase to review or edit their discovery answers.
- If the user modifies and re-saves `docs/00_DISCOVERY_ANSWERS.json` during a later phase, re-read `docs/00_DISCOVERY_ANSWERS.json`, update `docs/00_PROJECT_CONTRACT.md` and `docs/DECISIONS.md`, and sync affected downstream artifacts.

## Dynamic Platform Pointer Routing
When setting `NEXT_STEP_POINTER`:
- Read `platform` (`ios`, `android`, or `web`) from Document 00.
- For Phases 3, 5, 6, 7, 8, Release: point directly to `.agents/skills/platforms/${platform}/${skill}`.
- For Phases 1, 2, 4, State, Audit: point to `.agents/skills/core/${skill}`.
- Explicitly instruct the agent to **load ONLY the skill specified in the pointer** and never inspect other platform directories.

## Parallel Subagent Dispatch Engine (Phase 5 & 6)
When entering implementation after Phase 4 Schemas & Gate 2 Mockups are approved:
1. Do NOT execute Phase 5 and Phase 6 sequentially.
2. Dispatch both workers concurrently using `invoke_subagent`:
   - `invoke_subagent(TypeName="self", Role="Frontend UI Engineer", Prompt="Execute Phase 5: Read platforms/<platform>/05_frontend_developer. Build component tree matching approved mockups, verify compilation (npx tsc --noEmit), and return completion report.")`
   - `invoke_subagent(TypeName="self", Role="Database & Service Engineer", Prompt="Execute Phase 6: Read platforms/<platform>/06_service_engineer. Configure SQLite/DB schemas, write services/hooks, verify compilation (npx tsc --noEmit), and return completion report.")`
3. Record both subagent conversation IDs in `docs/PROJECT_STATUS.md`.
4. Wait for messages from both subagents (Reactive Wakeup).
5. When both report green build exit code 0:
   - Run Architecture Reviewer audit on combined output.
   - Advance `NEXT_STEP_POINTER` to Phase 7 QA.

## Every Turn (silent; never dump state into chat)
1. Rewrite `docs/PROJECT_STATUS.md` (≤65 lines; keep the last 3 session rows).
2. Rewrite `docs/progress-data.js`, following the schema in `assets/progress-data.sample.js` (always preserving `consultantDiscovery`).
3. If `docs/progress.html`, `docs/progress.min.js`, or `docs/dashboard-server.js` is missing, copy them from `.agents/skills/core/10_orchestrator/assets/` with `cp`.

## `docs/PROJECT_STATUS.md`
```markdown
# PROJECT STATUS — [Project]
**Platform:** [IOS|ANDROID|WEB] | **Mode:** [BALANCED|AUTOPILOT|SUPERVISED] | **Updated:** [ISO 8601]
### 🎯 NEXT_STEP_POINTER: .agents/skills/[core|platforms/<platform>]/[skill] — [Agent] to [action]. [Execute immediately | Awaiting user]

## Phases
- [ ] Phase 1 Discovery — core/01_it_consultant — [status]
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

## Transitions
- Stop Point: Orchestrator sets status, populates `pendingReview`, outputs clean 3-part message (Current Step, What to Review, Next Action), and ends turn.
- On `approved` / `submitted`: Reads `docs/00_DISCOVERY_ANSWERS.json` (in Phase 1) or appends decision to `docs/DECISIONS.md`, clears `pendingReview`, advances pointer.
