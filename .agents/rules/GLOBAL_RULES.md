# Global SDLC Swarm Rules

Single authority for phases, paths, statuses, gates, and the review loop. Skills hold role-specific rules only and never restate these.

## 1. Principles
- Solo founder + AI swarm. Features ship as vertical slices (UI → service → DB per story).
- **Capabilities:** `docs/00_PROJECT_CONTRACT.md` sets each capability `required | none | deferred`.
  - `none` → skip that layer; mark its checks `[N/A — CAPABILITY NOT REQUIRED]`. authentication: login, JWT, `AuthContext`, 401 tests · persistence: schemas, ORM, migrations, cloud DB · offline_writes: outbox, retry workers, tombstones · shared_records: tenant/team checks (creator ownership only) · backend: service engineering.
  - `deferred` → mocks; mark `[UNVERIFIED — DEPENDENCY DEFERRED]`; production blocked until resolved.
  - Never set an uncertain essential capability to `none` to avoid work.
- Architecture Reviewer audits every phase deliverable against Document 00.
- **Output:** write artifacts to disk; in chat return file links + ≤3 bullets. Terse, no filler. Load only the artifacts the active step needs.

## 2. Flow
Phase 1 Discovery → 2 Scope → 3 Tech Spec → 4 Schemas → per story [5 UI → 6 Services → 7 QA] → aggregate QA → 8 UAT → Release.
Passing slice QA moves to the next story; only aggregate QA reaches Phase 8; only Gate 3 reaches Release. Role registry and commands: `.agents/skills/00_pm/SKILL.md`.

## 3. Canonical Paths
Document prefixes are stable IDs, not phase order.
| ID | Path | Owner |
|---|---|---|
| 00 | `docs/00_PROJECT_CONTRACT.md` | Phase 1 |
| 01 | `docs/01_ARCH_BRIEF.md` | Phase 1 |
| 02 | `docs/02_PRD.md` | Phase 2 |
| 03 | `docs/03_USER_STORIES.md` | Phase 2 |
| 04 | `docs/04_TECHNICAL_SPEC.md` | Phase 3 |
| 05 | `docs/05_TASK_MANIFEST.md` | Phase 3 |
| — | `src/assets/schemas/` | Phase 4 |
| 06 | `docs/06_DESIGN_REGISTER.md` (+ `docs/design/mockups/`) | Phase 5 |
| 07 | `tests/07_TEST_MANIFEST.md` | Phase 7 |
| 08 | `docs/08_SETUP_REGISTER.md` | Phase 6 / Release |
| 09 | `docs/09_RELEASE_PLAN.md` | Release |
| 10 | `docs/10_UAT_CHECKLIST.md` | Phase 8 |
| — | `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md`, `docs/progress.html`, `docs/progress-data.js` | Orchestrator |
| — | `docs/reviews/0N_ARCH_REVIEW_PHASE_N.md` | Reviewer |
| — | `UAT_FEEDBACK.md` | Phase 8 (on revisions) |

## 4. Statuses
`[NOT STARTED]` `[IN PROGRESS]` `[AWAITING USER SETUP]` `[AWAITING PEER REVIEW]` `[AWAITING MANAGER APPROVAL]` `[AWAITING UAT SIGN-OFF]` `[COMPLETED & LOCKED]` `[SKIPPED — MOCKS ONLY]` `[SKIPPED — USER MANAGED]` `[N/A — CAPABILITY NOT REQUIRED]` `[UNVERIFIED — DEPENDENCY DEFERRED]` `[STALE — REVISION REQUIRED]`
Terminal pointers: `COMPLETE — RELEASE VERIFIED`, `COMPLETE — USER MANAGED HANDOFF`.

## 5. Stop Points & Autonomy
| Stop point | BALANCED (default) | AUTOPILOT | SUPERVISED |
|---|:-:|:-:|:-:|
| Gate 1 — Scope (02, 03) | ✅ | — | ✅ |
| Gate 2 — Mockups (06) | ✅ | ✅ | ✅ |
| DB setup/skip (Phase 6 entry) | ✅ | ✅ | ✅ |
| Gate 3 — UAT sign-off (10) | ✅ | ✅ | ✅ |
| Deployment select/skip (Release) | ✅ | ✅ | ✅ |
| Gate 4 — Release plan (09) | ✅ | ✅ | ✅ |
| End of every other phase | — | — | ✅ |
- AUTOPILOT may carry documented low-impact assumptions but stops when an open decision would drop a core workflow or fix platform, data, or security architecture.
- Approvals carry across slices until the approved artifact or setup changes.
- **Revision cascade:** an upstream change marks downstream artifacts `[STALE — REVISION REQUIRED]` and reopens approvals from the earliest affected phase. Sign-offs record artifact, revision, approver, and scope.
- Mock-backed results stay qualified and never authorize production.

## 6. Review Loop (every stop point)
1. Orchestrator refreshes `docs/progress-data.js`. The Reviewer supplies the decisions: recommended option first, alternatives, optional perks.
2. End the turn with: `👉 Review in docs/progress.html (⚡ Approvals). Type "approved" to accept the recommended options, or reply with changes (e.g. "D2: B", "add P1", or free text).`
3. Changes → revise, refresh the dashboard, stop again. Repeat until the user types `approved`.
4. `approved` → record decisions in `docs/DECISIONS.md` and advance.
Silence, `/pm resume`, and `/pm next` are never approval.
