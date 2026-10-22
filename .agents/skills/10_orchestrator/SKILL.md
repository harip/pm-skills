---
name: orchestrator
description: State machine engine. Initializes & overwrites docs/PROJECT_STATUS.md every turn for cold-start resumption.
---

# Orchestrator (State Machine Engine)

Keep conversation response terse, condensed, and clear. Use canonical document IDs from Global Rules; they do not define phase order.
See `.agents/rules/GLOBAL_RULES.md` for shared protocols and document numbering.

## Non-Negotiables & Rules
- **Invisible Execution:** Overwrite `docs/PROJECT_STATUS.md` silently on disk at the end of *every user turn*. Never dump raw table in chat unless requested.
- **Line Limit & Session Cap:** Keep `PROJECT_STATUS.md` under 65 lines. Maintain rolling **3-session log cap** (delete oldest rows).
- **Status Enums:** Use the authoritative vocabulary in Global Rules, including `[AWAITING USER SETUP]`, `[AWAITING UAT SIGN-OFF]`, and `[STALE — REVISION REQUIRED]`.
- **Visual Progress Synchronization:** Copy `assets/progress.html` and `assets/progress.js` into `docs/progress.html` and `docs/progress.js` in the project `docs/` folder at every turn with current phase, deliverables index, interactive User Stories viewer, automated QA test summary, and selected UAT environment link.
- **Document Links Alignment:** Ensure `docs/progress.html` links directly to all project deliverables (`docs/00_PROJECT_CONTRACT.md`, `docs/01_ARCH_BRIEF.md`, `docs/02_PRD.md`, `docs/03_USER_STORIES.md`, `docs/04_TECHNICAL_SPEC.md`, `docs/05_TASK_MANIFEST.md`, `src/assets/schemas/`, `docs/06_DESIGN_REGISTER.md`, `tests/07_TEST_MANIFEST.md`, `docs/08_SETUP_REGISTER.md`, `docs/09_RELEASE_PLAN.md`, `docs/10_UAT_CHECKLIST.md`).
- **Gate 2 UI Mockup Stop Point:** Clearly flag Phase 5 (UI/UX) as a mandatory autonomy stop point. When UI mockups are created, pause execution for manager approval before frontend code implementation.
- **Dashboard Template:** Use `assets/progress.html` + `assets/progress.js` in `.agents/skills/orchestrator/assets/` as master templates; copy them into `docs/progress.html` and `docs/progress.js` to render the live visualizer dashboard. Before access exists, render a disabled pending-access label instead of an empty or placeholder link.

## Template: `docs/PROJECT_STATUS.md`
```markdown
# PROJECT STATUS — [Project Name]
**Autonomy Mode:** [BALANCED|AUTOPILOT|SUPERVISED] | **Last Updated:** [ISO 8601]
### 🎯 NEXT_STEP_POINTER: Phase [N] or Release, Story [US-NNN or aggregate], Step [N] — [Agent] to [action]. [Execute immediately | Awaiting user].

## Phase Progress
- [ ] Phase 1 (Discovery & Contract): `docs/00_PROJECT_CONTRACT.md`, `docs/01_ARCH_BRIEF.md` — [Status] | Agent: IT Consultant
- [ ] Phase 2 (Scope): `docs/02_PRD.md`, `docs/03_USER_STORIES.md` — [Status] | Agent: Product Owner
- [ ] Phase 3 (Tech Spec): `docs/04_TECHNICAL_SPEC.md`, `docs/05_TASK_MANIFEST.md` — [Status] | Agent: Technical Architect
- [ ] Phase 4 (Schemas): `src/assets/schemas/` — [Status] | Agent: Content Parser
- [ ] Phase 5 (UI/UX): `docs/06_DESIGN_REGISTER.md`, `src/components/` — [Status] | Agent: Frontend Developer [🛑 Gate 2 Stop Point]
- [ ] Phase 6 (Database Setup & Service): `src/services/`, `src/hooks/`, `src/db/` — [Status] | Agent: Service Engineer
- [ ] Phase 7 (QA): `tests/07_TEST_MANIFEST.md` — [Status] | Agent: QA Agent
- [ ] Phase 8 (UAT): `docs/10_UAT_CHECKLIST.md` — [Status] | Agent: UAT Coordinator

- [ ] Release (Provider Setup & Deployment): `docs/08_SETUP_REGISTER.md`, `docs/09_RELEASE_PLAN.md` — [Status] | Agent: Deployment Lead

## Session Log (Rolling 3 Cap)
| # | Date | Completed | Ended At |

## Artifact Index
| Artifact | Path | Phase | Status |
| Capability Contract | `docs/00_PROJECT_CONTRACT.md` | 1 | [enum] |
| Architecture Brief | `docs/01_ARCH_BRIEF.md` | 1 | [enum] |
| PRD | `docs/02_PRD.md` | 2 | [enum] |
| User Stories | `docs/03_USER_STORIES.md` | 2 | [enum] |
| Technical Spec | `docs/04_TECHNICAL_SPEC.md` | 3 | [enum] |
| Task Manifest | `docs/05_TASK_MANIFEST.md` | 3 | [enum] |
| Schemas | `src/assets/schemas/` | 4 | [enum] |
| Design Register | `docs/06_DESIGN_REGISTER.md` | 5 | [enum] |
| Screen Mockups | `docs/design/mockups/` | 5 | [enum] |
| Test Manifest | `tests/07_TEST_MANIFEST.md` | 7 | [enum] |
| Setup Register | `docs/08_SETUP_REGISTER.md` | 6 / Release | [enum] |
| Release Plan | `docs/09_RELEASE_PLAN.md` | Release | [enum] |
| UAT Checklist | `docs/10_UAT_CHECKLIST.md` | 8 | [enum] |
```

## Gateway & Revision Transition Logic
1. **Phase 1 Contract Check:** Read `docs/00_PROJECT_CONTRACT.md` (Document 00). Confirmed capabilities declared `none` set only corresponding downstream work to `[N/A — CAPABILITY NOT REQUIRED]`.
2. **Revision Invalidation Cascade:** If an upstream document is edited (e.g. `02_PRD.md` modified), mark all downstream artifacts as `[STALE — REVISION REQUIRED]` until reviewed and re-verified.
3. **Gate 2 Mockup Checkpoint:** At the Phase 5 mockup checkpoint, set `[AWAITING MANAGER APPROVAL]` in `PROJECT_STATUS.md` with a review pointer before writing UI code. Execution HALTS across all autonomy modes (Balanced, Autopilot, Supervised).
4. Track active/remaining stories in the task manifest. After slice QA passes, return to Phase 5 for the next story; keep aggregate Phase 5–7 progress open until all scoped slices finish. After all slices and integrated release regression QA pass, set Phase 8 UAT Coordinator as the next lead. Gate 3 uses `[AWAITING UAT SIGN-OFF]`. Approved UAT hands off to Release.
5. Database setup/skip stays at Phase 6 entry. Deployment selection/skip stays in Release. Gate 4 approves the prepared release plan; successful verification completes Release.
6. On explicit deployment skip, record `[SKIPPED — USER MANAGED]` for Release and set `NEXT_STEP_POINTER: COMPLETE — USER MANAGED HANDOFF`.

## Cold-Start Resumption
When user says *"Read PROJECT_STATUS.md and continue"*:
1. Parse `NEXT_STEP_POINTER`.
2. Announce: `🔄 Session Resumed. Autonomy: [Mode]. Executing → [Agent].`
3. Execute the next actionable step. If awaiting setup or sign-off, reopen that pending action; resume is not consent. If the pointer is terminal, report the recorded outcome.

