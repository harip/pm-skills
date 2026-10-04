---
name: orchestrator
description: State machine engine. Initializes & overwrites docs/PROJECT_STATUS.md every turn for cold-start resumption.
---

# Orchestrator (State Machine Engine)

Keep conversation response terse, condensed, and clear. All generated documents must be numbered to show execution order.
See `.agents/rules/GLOBAL_RULES.md` for shared protocols and document numbering.

## Non-Negotiables & Rules
- **Invisible Execution:** Overwrite `docs/PROJECT_STATUS.md` silently on disk at the end of *every user turn*. Never dump raw table in chat unless requested.
- **Line Limit & Session Cap:** Keep `PROJECT_STATUS.md` under 65 lines. Maintain rolling **3-session log cap** (delete oldest rows).
- **Exact Status Enums:** `[NOT STARTED] | [IN PROGRESS] | [AWAITING USER SETUP] | [AWAITING PEER REVIEW] | [AWAITING MANAGER APPROVAL] | [COMPLETED & LOCKED] | [SKIPPED — USER MANAGED] | [N/A — CAPABILITY NOT REQUIRED] | [UNVERIFIED — DEPENDENCY DEFERRED] | [STALE — REVISION REQUIRED]`.
- **Visual Progress Synchronization:** Keep project root `progress.html` updated at every turn with current phase, deliverables index, and StackBlitz sandbox link.

## Template: `docs/PROJECT_STATUS.md`
```markdown
# PROJECT STATUS — [Project Name]
**Autonomy Mode:** [BALANCED|AUTOPILOT|SUPERVISED] | **Last Updated:** [ISO 8601]
### 🎯 NEXT_STEP_POINTER: Phase [N] or Release, Step [N] — [Agent] to [action]. [Execute immediately | Awaiting user].

## Phase Progress
- [ ] Phase 0 (Contract): `docs/00_PROJECT_CONTRACT.md` — [Status] | Agent: IT Consultant
- [ ] Phase 1 (Discovery): `docs/01_ARCH_BRIEF.md` — [Status] | Agent: IT Consultant
- [ ] Phase 2 (Scope): `docs/02_PRD.md`, `docs/03_USER_STORIES.md` — [Status] | Agent: Product Owner
- [ ] Phase 3 (Tech Spec): `docs/04_TECHNICAL_SPEC.md`, `docs/05_TASK_MANIFEST.md` — [Status] | Agent: Tech Architect
- [ ] Phase 4 (Schemas): `src/assets/schemas/` — [Status] | Agent: Content Parser
- [ ] Phase 5 (UI/UX): `docs/06_DESIGN_REGISTER.md`, `src/components/` — [Status] | Agent: Frontend Dev
- [ ] Phase 6 (Database Setup & Service): `src/services/`, `src/hooks/`, `src/db/` — [Status] | Agent: Service Eng
- [ ] Phase 7 (QA): `tests/07_TEST_MANIFEST.md` — [Status] | Agent: QA Agent
- [ ] Phase 8 (UAT): `docs/10_UAT_CHECKLIST.md` — [Status] | Agent: UAT Coordinator (StackBlitz Sandbox)

- [ ] Release (Provider Setup & Deployment): `docs/08_SETUP_REGISTER.md`, `docs/09_RELEASE_PLAN.md` — [Status] | Agent: Deployment Lead

## Session Log (Rolling 3 Cap)
| # | Date | Completed | Ended At |

## Artifact Index
| Artifact | Path | Phase | Status |
| Capability Contract | `docs/00_PROJECT_CONTRACT.md` | 0 | [enum] |
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
```

## Gateway & Revision Transition Logic
1. **Phase 0 Contract Check:** Read `docs/00_PROJECT_CONTRACT.md` (Document 00). Any capability declared `none` sets downstream phases to `[N/A — CAPABILITY NOT REQUIRED]`.
2. **Revision Invalidation Cascade:** If an upstream document is edited (e.g. `02_PRD.md` modified), mark all downstream artifacts as `[STALE — REVISION REQUIRED]` until reviewed and re-verified.
3. At the mockup checkpoint, set `[AWAITING MANAGER APPROVAL]` with a review pointer before UI implementation.
4. On explicit deployment skip, record `[SKIPPED — USER MANAGED]` for Release and set `NEXT_STEP_POINTER: COMPLETE — USER MANAGED HANDOFF`.

## Cold-Start Resumption
When user says *"Read PROJECT_STATUS.md and continue"*:
1. Parse `NEXT_STEP_POINTER`.
2. Announce: `🔄 Session Resumed. Autonomy: [Mode]. Executing → [Agent].`
3. Execute the next actionable step.

