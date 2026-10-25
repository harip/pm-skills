---
name: pm
description: Entry point for the PM SDLC swarm. Handles /pm commands and routes each step to its phase lead.
---

# PM (Entry & Routing)

## Commands
- `/pm <ios|android|web> start "<pitch>"` — start a production project in root workspace for the chosen platform.
- `/pm test <ios|android|web> "<pitch>"` — start an isolated test drive in `sandbox/`.
- `/pm test clean` — delete the `sandbox/` directory.
- `/pm resume` — execute `NEXT_STEP_POINTER`; at a pending stop point, re-present the review.
- `/pm status` — show project, phase, agent, next step. No execution.
- `submitted` / `refine` — process saved Phase 1 Discovery Questionnaire & Mockup answers from `docs/00_DISCOVERY_ANSWERS.json`.
- `approved` — accept the pending UAT or Release review (Global Rules §6).
- `/pm help` — list commands.

## Streamlined Execution Model (No Modes Required)
Every project runs with a single, predictable lifecycle:
1. **Gate 1 — Phase 1 Interactive Discovery Questionnaire & Screen Mockups (`docs/progress.html`)**: Always required. The IT Consultant generates the interactive HTML screen mockups (`docs/design/mockups/scr_001_v1.html`..`scr_00N_v1.html`), 8–12 AI feature recommendations, and 8–12 deep discovery questions inside `docs/progress.html`. The user reviews mockups, answers questions, clicks **Save** (`docs/00_DISCOVERY_ANSWERS.json`), and replies `submitted` (or `refine` for follow-up consultation).
2. **Autonomous Build & Verification Pipeline (Phases 2 → 7)**: Once `docs/00_DISCOVERY_ANSWERS.json` is submitted, the swarm autonomously executes Phase 1 Contract/Brief (`00`, `01`) → Phase 2 Scope (`02`, `03`) → Phase 3 Tech Spec (`04`, `05`) → Phase 4 Schemas & Scaffolding → **Parallel [Phase 5 UI || Phase 6 Services]** → Phase 7 Automated QA + Mandatory Playwright WebKit Runtime Render Gate without stopping at intermediate phases.
3. **Gate 2 — Phase 8 Live UAT (`08_uat`)**: The workflow **always stops at Phase 8 UAT**, presenting the verified live app (Browser URL + Expo Go QR code & `10_UAT_CHECKLIST.md`) for real stakeholder acceptance testing before Phase 9 Release.

## Registry & Directory Architecture
Paths are organized into **Core Governance** and **Platform-Specific Tracks**:

### Core Swarm Skills (`.agents/skills/core/`)
| Stage | Role | Skill Path |
|---|---|---|
| Swarm Router | PM Entry | `core/00_pm` |
| Phase 1 — Discovery, Mockups & Intake | IT Consultant | `core/01_it_consultant` |
| Phase 2 — Scope | Product Owner | `core/02_product_owner` |
| Phase 4 — Schemas | Content Parser | `core/04_content_parser` |
| State & Dashboard | Orchestrator | `core/10_orchestrator` |
| Cross-Phase Audit | Architecture Reviewer | `core/11_architecture_reviewer` |

### Platform Implementation Tracks (`.agents/skills/platforms/<platform>/`)
Where `<platform>` is bound in Document 00 to `ios`, `android`, or `web`:
| Stage | Role | Skill Path |
|---|---|---|
| Phase 3 — Tech Spec | Technical Architect | `platforms/<platform>/03_technical_architect` |
| Phase 5 — UI Engineering | Frontend Developer | `platforms/<platform>/05_frontend_developer` |
| Phase 6 — DB Setup & Services | Service Engineer | `platforms/<platform>/06_service_engineer` |
| Phase 7 — QA Testing | QA Agent | `platforms/<platform>/07_qa_agent` |
| Phase 8 — Target UAT | UAT Coordinator | `platforms/<platform>/08_uat` |
| Release & Deployment | Deployment Lead | `platforms/<platform>/09_deployment` |

## Strict Context Boundary Rule
- When a project platform is bound (e.g. `platform: ios`), the agent must **ONLY** load skills from `.agents/skills/platforms/ios/` and `.agents/skills/core/`.
- The agent is **strictly forbidden from reading or referencing** unselected platform directories (e.g., never load `platforms/web/` or `platforms/android/` during an iOS run).
