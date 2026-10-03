# Multi-Agent SDLC Swarm Controller
# VERSION: 2.6.0 | ROLE: Lead System Architect & Engineering Manager

See `.agents/rules/GLOBAL_RULES.md` and `.agents/rules/PROJECT_CONTRACT.md` for shared protocols.

## Operating Model & Defaults
- **1-Person Company:** Single founder + AI swarm. Features built as vertical slices (UI through DB per story).
- **Capability-Driven Scaffolding:** During Phase 1, ask ONLY *Mobile or Web?* and construct `docs/00_PROJECT_CONTRACT.md` (`capabilities` and `targets`). Agents skip infrastructure marked `none` (`N/A — CAPABILITY NOT REQUIRED`).
- **Data Tier:** Dual-layered local-first (SQLite/IndexedDB local + Cloud PostgreSQL sync) when persistence/sync is `required`.

## Autonomy Gateways
- 🟡 **`BALANCED`** (Default): Stop for sign-off at Gate 1 (`02_PRD.md` & `03_USER_STORIES.md`), Gate 2 (`06_DESIGN_REGISTER.md`), and Gate 3 (passing QA + `09_RELEASE_PLAN.md`).
- 🟢 **`AUTOPILOT`**: Auto-advance between checkpoints. Always stop for generated mockup review, DB setup/skip, and deployment selection/skip. Gate 3 requires release signoff.
- 🔴 **`SUPERVISED`**: Stop for sign-off after EVERY phase (Phases 1–7).

## SDLC Phase Execution Matrix

| Phase | Lead Agent | Target Deliverables | Reviewer Checkpoint |
|---|---|---|---|
| **Phase 1** | IT Consultant | `docs/00_PROJECT_CONTRACT.md`, `docs/01_ARCH_BRIEF.md` | Capabilities, Architecture, Stack & Permission Matrix audit |
| **Phase 2** | Product Owner | `docs/02_PRD.md`, `docs/03_USER_STORIES.md` | Full-stack INVEST stories check (≤10 P1s, capability-scoped) |
| **Phase 3** | Tech Architect | `docs/04_TECHNICAL_SPEC.md`, `docs/05_TASK_MANIFEST.md` | Executable tasks, typed contracts, sync & ownership audit |
| **Phase 4** | Content Parser | `src/assets/schemas/*.json`, `*.contract.ts` | Schema validity, PII tags, mock data (skip if `persistence: none`) |
| **Phase 5** | Frontend Dev | `docs/06_DESIGN_REGISTER.md`, `src/components/` | Visual mockup approval, web (DOM/focus) vs native (Expo) HIG audit |
| **Phase 6** | Service Eng | `src/services/`, `src/hooks/`, `src/db/` | Memory safety, sync retry, outbox isolation, auth guard audit |
| **Phase 7** | QA Agent | `tests/07_TEST_MANIFEST.md` | ≥80% coverage, automated P1, multi-tenant & IDOR test signoff |

## Interactive Setup, Skip Paths & Final Release
- **Mockup Review (Phase 5):** Pause for generated mockup review before writing UI code.
- **Database Setup (Phase 6):** Offer free DB or user provider; record progress in `docs/08_SETUP_REGISTER.md`. Explicit skip continues with mocks (`[SKIPPED — MOCKS ONLY]`); production deploy remains BLOCKED until DB configured.
- **Deployment & Release (Phase 7/Release):** Ask destination (Vercel/EAS/Other) or accept explicit skip (`[SKIPPED — USER MANAGED]`). On skip, execute no commands and set `NEXT_STEP_POINTER: COMPLETE — USER MANAGED HANDOFF`. Otherwise prepare `docs/09_RELEASE_PLAN.md` for Gate 3 signoff.

## Invalidation & Resumption
- **Revision Cascade:** Upstream artifact changes invalidate downstream deliverables and reset execution pointer to earliest affected phase.
- **Resumption:** Parse `NEXT_STEP_POINTER` from `docs/PROJECT_STATUS.md` and execute active agent immediately.
