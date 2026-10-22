---
name: pm
description: Entry point for the PM SDLC swarm. Handles /pm commands.
---

# PM Command (Swarm Entry Point)

Use `.agents/rules/GLOBAL_RULES.md` as the authority for roles, phases, gates, and artifact paths. `../PROJECT_BUILDER_SKILL.md` describes the controller workflow; Orchestrator persists state.

## Commands
- `/pm` — Show active project or start intake.
- `/pm start <name> [mode]` — Initialize project in specified mode (`balanced`, `autopilot`, or `supervised`; defaults to `balanced`) and start Phase 1 intake.
- `/pm mode <balanced|autopilot|supervised>` — Switch or set active autonomy mode at any time.
- `/pm resume` or `approved` — Ingest `docs/APPROVALS.json`, read `NEXT_STEP_POINTER` in `PROJECT_STATUS.md`, and execute next assigned phase lead.
- `/pm status` — Display project, mode, phase, agent, and next step without executing.
- `/pm next` — Force execute `NEXT_STEP_POINTER` (respecting gate approvals).
- `/pm help` — Display command list.

## Routing Matrix
Paths are relative to `.agents/skills/`. The contract and architecture brief both belong to Phase 1.
| Target | Agent | Skill Path |
|---|---|---|
| Phase 1 | IT Consultant | `01_it_consultant/SKILL.md` |
| Phase 2 | Product Owner | `02_product_owner/SKILL.md` |
| Phase 3 | Technical Architect | `03_technical_architect/SKILL.md` |
| Phase 4 | Content Parser | `04_content_parser/SKILL.md` |
| Phase 5 | Frontend Developer | `05_frontend_developer/SKILL.md` |
| Phase 6 (database setup first) | Service Engineer | `06_service_engineer/SKILL.md` |
| Phase 7 | QA Agent | `07_qa_agent/SKILL.md` |
| Phase 8 | UAT Coordinator | `08_uat/SKILL.md` |
| Release (provider setup, approval, deployment) | Deployment Lead | `09_deployment/SKILL.md` |
| Audit | Architecture Reviewer | `11_architecture_reviewer/SKILL.md` |
| State | Orchestrator | `10_orchestrator/SKILL.md` |
| Phase 5 design support | Apple Design (`apple-design`) | `12_apple_design/SKILL.md` |

PM is the entry/routing skill. Audit, state, and design support are not sequential phases.

## Execution Protocol
1. **Start:** If `PROJECT_STATUS.md` exists → suggest `/pm resume`. Else prompt pitch, set `NEXT_STEP_POINTER: Phase 1`, run IT Consultant.
2. **Resume/Next:** Load `NEXT_STEP_POINTER` agent skill → execute step → run Architecture Reviewer → run Orchestrator to update `PROJECT_STATUS.md`.
3. **Gate Rules:** Follow Global Rules: Gate 1 = scope, Gate 2 = mockups, Gate 3 = UAT, Gate 4 = release plan. After slice QA, route to Phase 5 for the next story. After all slices and aggregate Phase 7 QA pass, route to Phase 8 UAT Coordinator; after UAT sign-off, route to Deployment Lead for Release. Database setup/skip remains at Phase 6 entry; deployment selection/skip remains in Release. `/pm next` and resume cannot bypass required setup or approvals.

Apply Global Rules §8 for discovery uncertainty, per-story routing, early verification planning, NFR evidence, and target-platform UAT. Resume the active story recorded in the state pointer; do not treat a passing slice as a completed release.
