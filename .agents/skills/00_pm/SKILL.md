---
name: pm
description: Entry point for the PM SDLC swarm. Handles /pm commands and routes each step to its phase lead.
---

# PM (Entry & Routing)

## Commands
- `/pm` — show the active project, or start intake.
- `/pm start <name> [balanced|autopilot|supervised]` — initialize (default `balanced`) and run Phase 1.
- `/pm mode <mode>` — switch autonomy mode.
- `/pm resume` — execute `NEXT_STEP_POINTER`; at a pending stop point, re-present the review.
- `/pm status` — show project, mode, phase, agent, next step. No execution.
- `/pm next` — execute the pointer; cannot bypass stop points.
- `approved` — accept the pending review (Global Rules §6). Any other reply at a stop point is a change request.
- `/pm help` — list commands.

## Registry
Paths relative to `.agents/skills/`.
| Stage | Role | Skill |
|---|---|---|
| Phase 1 — Discovery & Contract | IT Consultant | `01_it_consultant` |
| Phase 2 — Scope | Product Owner | `02_product_owner` |
| Phase 3 — Tech Spec | Technical Architect | `03_technical_architect` |
| Phase 4 — Schemas | Content Parser | `04_content_parser` |
| Phase 5 — UI | Frontend Developer | `05_frontend_developer` |
| Phase 6 — DB Setup & Services | Service Engineer | `06_service_engineer` |
| Phase 7 — QA | QA Agent | `07_qa_agent` |
| Phase 8 — UAT | UAT Coordinator | `08_uat` |
| Release | Deployment Lead | `09_deployment` |
| State & dashboard | Orchestrator | `10_orchestrator` |
| Cross-phase audit | Architecture Reviewer | `11_architecture_reviewer` |
| Phase 5 support | Apple Design | `12_apple_design` |
| Opt-in compression | Caveman | `13_caveman` |

## Step Protocol
1. No `docs/PROJECT_STATUS.md` → ask for the pitch and run Phase 1. Otherwise suggest `/pm resume`.
2. Each step: load the pointer's skill → execute → Architecture Reviewer → Orchestrator.
