# Global SDLC Swarm Rules

Single authority for phases, paths, statuses, gates, and the review loop. Skills hold role-specific rules only and never restate these.

## 1. Principles
- Solo founder + AI swarm. Features ship as vertical slices (UI → service → DB per story).
- **Capabilities:** `docs/00_PROJECT_CONTRACT.md` sets each capability `required | none | deferred`.
  - `none` → skip that layer; mark its checks `[N/A — CAPABILITY NOT REQUIRED]`. authentication: login, JWT, `AuthContext`, 401 tests · persistence: schemas, ORM, migrations, cloud DB · offline_writes: outbox, retry workers, tombstones · shared_records: tenant/team checks (creator ownership only) · backend: service engineering.
  - `deferred` → mocks; mark `[UNVERIFIED — DEPENDENCY DEFERRED]`; production blocked until resolved.
  - Never set an uncertain essential capability to `none` to avoid work.
- Architecture Reviewer audits every phase deliverable against Document 00.
- **Output (Terse Execution Mode with Phase 1 Interactive Questionnaire & Mockups Exception):**
  - **Phase 1 Intake Exception (`01_it_consultant`)**: During Phase 1 Discovery, Terse Mode is suspended. The IT Consultant generates interactive HTML/CSS/SVG screen mockups (`docs/design/mockups/scr_001_v1.html`..`scr_00N_v1.html`) and populates `window.PM_DATA.consultantDiscovery` in `docs/progress-data.js` with an Executive Advisory Brief, the embedded interactive Screen Mockups, 8–12 AI-recommended domain features (interactive checkboxes), and 8–12 thorough multi-dimensional questions (with per-question custom note inputs and open-ended Consultant Q&A textareas). All user answers and screen mockup notes save directly to `docs/00_DISCOVERY_ANSWERS.json` in `docs/` so the workflow reads them and the user can go back and edit answers at any point.
  - **Phases 2–9 Execution**: Write all artifacts to disk; in chat return strictly file links + ≤3 terse bullets. Zero filler, zero conversational preamble, zero robotic fluff. Focus purely on actionable state. Load only the artifacts the active step needs.

## 2. Unified Streamlined Flow & Parallel Concurrency
**Phase 1 Interactive Discovery & Mockups (`progress.html` Gate)** → *[Autonomous Build & QA Pipeline: Phase 1 Contract/Brief → Phase 2 Scope → Phase 3 Tech Spec → Phase 4 Schemas → **[Phase 5 UI || Phase 6 Services (Parallel Subagents)]** → Phase 7 QA + Playwright WebKit Runtime Gate]* → **Phase 8 Live UAT (`08_uat` Gate)** → **Phase 9 Release**.

### Parallel Subagent Dispatch (Phase 5 & Phase 6)
Once Phase 4 locks the schemas and data contracts:
1. The Orchestrator dispatches **Phase 5 Frontend Developer** and **Phase 6 Service Engineer** simultaneously using `invoke_subagent` (no separate Phase 5 mockup stop-point gate, since mockups are already defined and approved in Phase 1).
2. **Zero-Conflict Boundaries**:
   - Frontend Subagent owns: `src/components/`, `src/screens/`, `src/app/`, `docs/06_DESIGN_REGISTER.md` (implementing the approved Phase 1 mockups in `docs/design/mockups/`).
   - Service Engineer owns: `src/db/`, `src/services/`, `src/hooks/`, `docs/08_SETUP_REGISTER.md`.
   - Shared Read-Only Contract: Both read and conform to `src/assets/schemas/`. Neither modifies schemas.
3. **Compile Gate**: Both subagents must verify `npx tsc --noEmit` exits 0 before reporting completion.
4. **Join & Verification**: When both parallel subagents complete, the Orchestrator integrates the deliverables and routes immediately to Phase 7 QA (unit tests + mandatory Playwright WebKit headless runtime render gate). Passing Phase 7 QA advances automatically to **Phase 8 UAT**, where the workflow **always stops** for live stakeholder acceptance testing.

## 3. Canonical Paths
Document prefixes are stable IDs, not phase order.
| ID | Path | Owner |
|---|---|---|
| 00 | `docs/00_DISCOVERY_ANSWERS.json`, `docs/00_PROJECT_CONTRACT.md` | Phase 1 |
| 01 | `docs/01_ARCH_BRIEF.md` | Phase 1 |
| 02 | `docs/02_PRD.md` | Phase 2 |
| 03 | `docs/03_USER_STORIES.md` | Phase 2 |
| 04 | `docs/04_TECHNICAL_SPEC.md` | Phase 3 |
| 05 | `docs/05_TASK_MANIFEST.md` | Phase 3 |
| — | `src/assets/schemas/` | Phase 4 |
| 06 | `docs/06_DESIGN_REGISTER.md` (+ `docs/design/mockups/`) | Phase 1 (Mockups) & Phase 5 (UI Build) |
| 07 | `tests/07_TEST_MANIFEST.md` | Phase 7 |
| 08 | `docs/08_SETUP_REGISTER.md` | Phase 6 / Release |
| 09 | `docs/09_RELEASE_PLAN.md` | Release |
| 10 | `docs/10_UAT_CHECKLIST.md` | Phase 8 |
| — | `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md`, `docs/progress.html`, `docs/progress-data.js`, `docs/dashboard-server.js` | Orchestrator |
| — | `docs/reviews/0N_ARCH_REVIEW_PHASE_N.md` | Reviewer |
| — | `UAT_FEEDBACK.md` | Phase 8 (on revisions) |

## 4. Statuses
`[NOT STARTED]` `[IN PROGRESS]` `[AWAITING USER SETUP]` `[AWAITING PEER REVIEW]` `[AWAITING MANAGER APPROVAL]` `[AWAITING UAT SIGN-OFF]` `[COMPLETED & LOCKED]` `[SKIPPED — MOCKS ONLY]` `[SKIPPED — USER MANAGED]` `[N/A — CAPABILITY NOT REQUIRED]` `[UNVERIFIED — DEPENDENCY DEFERRED]` `[STALE — REVISION REQUIRED]`
Terminal pointers: `COMPLETE — RELEASE VERIFIED`, `COMPLETE — USER MANAGED HANDOFF`.

## 5. Mandatory Stop Points (No Mode Switching Needed)
There are no separate `autopilot` / `balanced` / `supervised` modes. Every project follows the same streamlined stop-point rules:
| Stop Point | Phase | Purpose | Mandatory? |
|---|---|---|:-:|
| **Gate 1 — Discovery Questionnaire & Screen Mockups** | Phase 1 (`01_it_consultant`) | User reviews interactive screen mockups, selects features, answers 8–12 discovery questions in `docs/progress.html`, and saves `docs/00_DISCOVERY_ANSWERS.json`. | ✅ Always |
| **External Cloud DB Credentials (Conditional)** | Phase 6 Entry (`06_service_engineer`) | Only pauses if the user selected an external cloud DB (e.g., Supabase) in Phase 1 that requires credentials; skipped automatically for local SQLite / IndexedDB / mocks. | Conditional |
| **Gate 2 — Live Target-Platform UAT** | Phase 8 (`08_uat`) | Workflow **always stops at Phase 8 UAT** after Phase 7 QA & Playwright WebKit runtime verification pass, presenting live Browser + Expo Go links & QR code. | ✅ Always |
| **Gate 3 — Production Release Sign-Off** | Phase 9 (`09_deployment`) | Final sign-off to execute production deployment or handoff after UAT approval. | ✅ Always |

- All intermediate phases (Phase 1 Contract/Brief generation after questionnaire submission → Phase 2 Scope → Phase 3 Tech Spec → Phase 4 Schemas → Parallel Phase 5 UI & Phase 6 Services → Phase 7 Automated QA & Playwright WebKit Gate) execute **autonomously without stopping**.
- **Revision cascade:** if the user goes back to the `💼 IT Consultant Questionnaire` tab in `docs/progress.html`, edits answers, and re-saves `docs/00_DISCOVERY_ANSWERS.json`, downstream affected artifacts are updated automatically.

## 6. Review Loop (at Gate 1 Discovery, Gate 2 UAT, and Gate 3 Release)
1. Orchestrator refreshes `docs/progress-data.js`.
2. In chat, output a clean 3-part message:
   - **Current Step**: Exactly what milestone was completed.
   - **What to Review**: Direct links to `docs/progress.html` or the live UAT preview.
   - **Next Action**: State clearly what to reply (`submitted` / `refine` at Gate 1 Discovery; `approved` at Gate 2 UAT and Gate 3 Release).
3. **Hard Halt Enforcement**: At Gate 1 and Gate 2 UAT, the agent **MUST STOP IMMEDIATELY** and call no further tools. It is strictly forbidden to advance autonomously past these gates without explicit user input (`submitted`/`refine` for Gate 1, or test findings/`approved` for Gate 2).
