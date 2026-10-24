---
name: orchestrator
description: State engine. Rewrites docs/PROJECT_STATUS.md and docs/progress-data.js every turn for cold-start resumption and the dashboard.
---

# Orchestrator (State & Dashboard)

## Every Turn (silent; never dump state into chat)
1. Rewrite `docs/PROJECT_STATUS.md` (≤65 lines; keep the last 3 session rows).
2. Rewrite `docs/progress-data.js`, following the schema in `assets/progress-data.sample.js`.
3. If `docs/progress.html` or `docs/progress.min.js` is missing, copy it from `assets/` with `cp`. Never read, regenerate, or edit those two files.

## `docs/PROJECT_STATUS.md`
```markdown
# PROJECT STATUS — [Project]
**Mode:** [BALANCED|AUTOPILOT|SUPERVISED] | **Updated:** [ISO 8601]
### 🎯 NEXT_STEP_POINTER: [Phase N | Release], Story [US-NNN | aggregate], Step [N] — [Agent] to [action]. [Execute immediately | Awaiting user]

## Phases
- [ ] Phase 1 Discovery — 00, 01 — [status]
- [ ] Phase 2 Scope — 02, 03 — [status]
- [ ] Phase 3 Tech Spec — 04, 05 — [status]
- [ ] Phase 4 Schemas — src/assets/schemas/ — [status]
- [ ] Phase 5 UI — 06, src/components/ — [status]
- [ ] Phase 6 Services — 08, src/services|hooks|db/ — [status]
- [ ] Phase 7 QA — 07 — [status]
- [ ] Phase 8 UAT — 10 — [status]
- [ ] Release — 08, 09 — [status]

## Sessions (last 3)
| # | Date | Completed | Ended at |
```

## Transitions
- Capabilities marked `none` in Document 00 set their downstream work to `[N/A — CAPABILITY NOT REQUIRED]`.
- At a stop point: set its status (`[AWAITING MANAGER APPROVAL]`, `[AWAITING USER SETUP]`, or `[AWAITING UAT SIGN-OFF]`), fill `pendingReview` in `progress-data.js` using crisp, human-friendly titles, plain English explanations, and realistic options from the Reviewer. At Gate 2 (Mockups), always populate `pendingReview.mockups` with all generated screen mockups so they embed directly into the approvals tab. Never use technical boilerplate or robotic phrases.
- On `approved`: append the stage, chosen options, perks, and date to `docs/DECISIONS.md`; clear `pendingReview`; advance the pointer.
- On a change request: route it to the owning lead, then refresh `pendingReview` and stop again.

## Resume
On `/pm resume` or "read PROJECT_STATUS.md and continue": parse the pointer, announce `🔄 Resumed. Mode: [mode]. Executing → [Agent].`, then execute. If awaiting review or setup, re-present it (resume is not consent). If the pointer is terminal, report the outcome.
