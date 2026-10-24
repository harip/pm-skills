---
name: pm
description: Entry point for the PM SDLC swarm. Handles /pm commands and routes each step to its phase lead.
---

# PM (Entry & Routing)

## Commands
- `/pm <ios|android|web> start "<pitch>" [balanced|autopilot|supervised]` — start a production project in root workspace for the chosen platform.
- `/pm test <ios|android|web> "<pitch>" [balanced|autopilot|supervised]` — start an isolated test drive in `sandbox/`.
- `/pm test clean` — delete the `sandbox/` directory.
- `/pm mode <mode>` — switch autonomy mode (`balanced`, `autopilot`, `supervised`).
- `/pm resume` — execute `NEXT_STEP_POINTER`; at a pending stop point, re-present the review.
- `/pm status` — show project, mode, phase, agent, next step. No execution.
- `/pm next` — execute the pointer; cannot bypass stop points.
- `approved` — accept the pending review (Global Rules §6).
- `/pm help` — list commands.

## Registry & Directory Architecture
Paths are organized into **Core Governance** and **Platform-Specific Tracks**:

### Core Swarm Skills (`.agents/skills/core/`)
| Stage | Role | Skill Path |
|---|---|---|
| Swarm Router | PM Entry | `core/00_pm` |
| Phase 1 — Discovery & Intake | IT Consultant | `core/01_it_consultant` |
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

## Step Protocol
1. **Workspace Root Detection**: If running via `/pm test`, all docs and code are isolated inside `sandbox/`. Otherwise in root workspace.
2. **True Concurrency in Phase 5 & 6**: Phases 1–4 establish the architecture, INVEST stories, and schemas. Once Phase 4 completes, the swarm uses `invoke_subagent` to spawn **Frontend Developer** and **Service Engineer** as concurrent parallel subagents. Both run simultaneously and synchronize before Phase 7 QA.
3. **Execution**: Read `NEXT_STEP_POINTER` from `PROJECT_STATUS.md` → load ONLY that skill file → execute → Architecture Reviewer → Orchestrator.
