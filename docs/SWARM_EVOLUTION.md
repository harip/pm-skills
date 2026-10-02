# Swarm Evolution: Adaptive, Evidence-Driven Execution

This document defines the next operating model for the SDLC swarm. It preserves vertical slices, bounded context, resumability, and zero-trust review while reducing unnecessary ceremony and making execution adaptable to the work being performed.

## 1. Work modes

The orchestrator MUST classify incoming work before planning execution:

- `NEW_PROJECT` — full product discovery and build lifecycle.
- `FEATURE` — add a user-facing vertical slice to an existing system.
- `BUG_FIX` — reproduce, repair, verify, and regression-test a defect.
- `REFACTOR` — change implementation without intentionally changing behavior.
- `HOTFIX` — minimal urgent production repair with focused verification and rollback planning.

The seven SDLC phases are a capability map, not a mandatory linear itinerary. `NEW_PROJECT` normally uses the full lifecycle. Other modes execute only the phases/capabilities required by scope and risk.

## 2. Autonomy modes

Projects MAY select an autonomy level:

- `SUPERVISED` — retain explicit approval at major phase boundaries.
- `BALANCED` — default. Require human approval for scope/design commitments and production deployment; routine intermediate gates may proceed automatically after verification.
- `AUTOPILOT` — proceed through non-destructive work automatically and stop only for ambiguous product decisions, privileged/destructive actions, unresolved blockers, or production release.

The orchestrator MUST record the active autonomy mode in project state.

## 3. Separate policy from stack defaults

Governance rules and technology preferences MUST be treated separately. Stack choices such as iOS, TypeScript/Node.js, PostgreSQL, SQLite/local-first storage, UUID strategy, and Apple-oriented UI are defaults, not universal policy.

A project SHOULD define a stack profile (for example `web-saas`, `mobile-ios`, `local-first`, or `ai-app`). Skills may recommend a default profile, but must allow an existing repository or explicit project constraint to override it.

## 4. Capability contracts

Agent names are useful for collaboration, but execution MUST be governed by capability contracts. Each invoked capability should identify:

1. required inputs;
2. allowed tools/actions;
3. expected artifacts;
4. invariants and constraints;
5. verification method;
6. completion criteria.

The orchestrator should dispatch capabilities based on the task graph rather than invoking every role for every change.

## 5. Machine-readable state

`docs/PROJECT_STATUS.md` remains the concise human-readable status view. The canonical execution state SHOULD be stored in `docs/project-state.json` (or an equivalent machine-readable format) when runtime support exists.

The state model should contain at least:

- schema version;
- project/work mode;
- autonomy mode;
- current node and next action;
- node statuses;
- blockers and retry counts;
- artifact references;
- stale/superseded artifacts;
- verification evidence references.

Until runtime support exists, `PROJECT_STATUS.md` remains authoritative, but orchestrator changes should remain compatible with eventual structured state.

## 6. Evidence-driven review

No reviewer may approve an assertion it has not verified. Findings and approvals SHOULD cite concrete evidence such as:

- command and result;
- test and result;
- file/path and relevant implementation;
- requirement/acceptance criterion and corresponding test;
- build, lint, typecheck, migration, or security-check result.

When evidence cannot be obtained, the reviewer must mark the item `UNVERIFIED` rather than infer success.

## 7. Traceability graph

Maintain traceability across:

`Goal -> Requirement -> Story -> Acceptance Criterion -> Implementation -> Test -> Evidence`

P1 acceptance criteria must remain executable-test backed. Critical authorization, destructive, payment, migration, synchronization, and data-loss paths require explicit verification even when aggregate coverage is high.

## 8. Risk-based quality gates

Coverage percentages are diagnostic floors, not proof of correctness. Quality gates prioritize:

- P1 acceptance criteria;
- authorization and IDOR boundaries;
- unauthenticated and role-boundary behavior;
- destructive/data-loss operations;
- payments and irreversible external effects;
- migrations and rollback;
- local/cloud synchronization conflicts;
- regressions for changed behavior;
- accessibility and critical UI states.

Coverage targets may remain as defaults, but a reviewer must not approve solely because a percentage threshold was met.

## 9. Failure and recovery semantics

Execution nodes may use the states `NOT_STARTED`, `IN_PROGRESS`, `AWAITING_REVIEW`, `AWAITING_APPROVAL`, `BLOCKED`, `RETRYING`, `FAILED`, `SUPERSEDED`, and `COMPLETED`.

For failures, record the cause, owner/capability, retry budget, remediation action, and whether downstream artifacts are stale. If a later discovery invalidates an earlier decision, mark affected artifacts `SUPERSEDED` or stale and route only the impacted nodes back through planning and verification.

## 10. Execution loop

The target execution model is:

`GOAL -> PLAN -> EXECUTE -> VERIFY -> REPAIR (if needed) -> VERIFY -> COMMIT -> NEXT`

Future runtime/CLI support should enforce state schemas and transitions programmatically with commands such as `pm init`, `pm status`, `pm next`, `pm verify`, `pm review`, and `pm resume`. Markdown skills remain the reasoning layer; deterministic tooling should own state validation and transition enforcement.
