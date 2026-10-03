# PM Skill Upgrade Report

Baseline: merged `master` commit `d59e6d4`.

This report records the recommended upgrades from the independent product, architecture/security, UX, QA, release, and workflow reviews. The controlled pilot is intentionally excluded.

## Priority order

1. Capability-based project contract
2. Artifact handoffs and revision-aware state
3. Scoped permissions and tenant boundaries
4. Complete offline-sync protocol
5. Executable infrastructure tasks
6. Platform-specific frontend rules
7. Evidence-based QA and accessibility
8. Separate design review from screenshot regression
9. Canonical paths and terminal states

## 1. Capability-based project contract

The workflow currently assumes that most projects need a database, cloud PostgreSQL, JWT authentication, ownership checks, offline sync, IDOR tests, and RLS. That is unsuitable for public/static websites.

Add `.agents/rules/PROJECT_CONTRACT.md` and create `docs/00_PROJECT_CONTRACT.md` during Phase 1. It should record:

```yaml
project_type: web | mobile
capabilities:
  public_content: true | false
  authentication: required | none
  persistence: required | none | deferred
  offline_writes: required | none
  shared_records: required | none
  backend: required | none | deferred
targets:
  database: provider | existing | mocks | none
  deployment: provider | user_managed | pending
```

`none` means related checks are `N/A — capability not required`; `deferred` permits mocks but blocks production. Agents must not add infrastructure merely to satisfy a check marked `none`.

## 2. Artifact handoffs and approvals

Frontend currently reads only the design register and schema contracts, although the register is created during Phase 5. It must also read the project contract, approved screen inventory, applicable PRD/user stories, technical platform constraints, task manifest, and contracts.

Add screen-to-story, acceptance-criteria, mockup-version, data-dependency, and permission-policy traceability.

Every approval should record artifact path, revision/hash, approver, scope, dependencies, and evidence. Before resume, compare current inputs with approved revisions. A changed story, contract, platform, capability, permission policy, schema, or technical specification must invalidate affected downstream artifacts and reopen approvals from the earliest affected phase.

## 3. Scoped permissions and tenant boundaries

The current `createdBy = auth.userId` rule with an unrestricted `ADMIN` bypass cannot represent shared household/team records and may create cross-tenant risk.

Treat `createdBy` as audit metadata. Define access by public access, creator ownership, team membership, tenant membership, tenant administrator, platform administrator, explicit sharing, and capability. Tenant administrators remain within their tenant; platform administration is separate.

Add tests for creator access, same-team shared access, private-record denial, tenant boundaries, platform administration, and unauthenticated behavior where applicable.

## 4. Complete offline-sync protocol

For projects with offline writes, require atomic record-plus-outbox writes, stable operation IDs, server idempotency, account/tenant scope, schema and payload versions, durable acknowledgement, retry classification, offline/auth recovery, user-visible pending/failed states, safe dead-letter replay, conflict resolution, tombstones, pull cursors, local migrations, payload upcasters, and upgrade tests with pending operations.

On logout or account switch, pause workers, stop in-flight work, clear or quarantine scoped data, bind queued work to its original principal, and resume only after revalidation. Account B must never replay account A's queue.

Test process death before enqueue, lost server acknowledgement, reconnect after retry exhaustion, account switching with pending writes, app upgrade with pending writes, and conflicting edits.

## 5. Executable infrastructure tasks

`docs/05_TASK_MANIFEST.md` needs owner, capability applicability, prerequisites, inputs, completion criteria, evidence, status, and blocking dependencies for every task. The relevant phase agent must read and execute applicable tasks and record evidence before the phase can complete. The architecture reviewer must block on incomplete required tasks.

## 6. Web/native frontend branches

Web rules should require Next.js App Router routes, semantic HTML, DOM labels, keyboard/focus behavior, browser tests, and rendered target measurements.

Native rules should require Expo/native navigation, `FlatList`/`FlashList` where applicable, `accessibilityLabel`, `testID`, device touch-target checks, and Maestro/device tests.

Do not require native `StyleSheet`, `FlatList`, or `src/screens` for web projects.

## 7. Evidence-based QA and accessibility

Do not treat `jest-axe` as proof of contrast, touch targets, keyboard access, or full accessibility. Its JSDOM contrast checks are disabled, and automated scans cannot prove full accessibility.

Split checks into rendered browser scan, contrast, keyboard navigation, focus visibility, screen-reader smoke test, native device accessibility, touch-target measurement, and manual review. Record each as `PASS`, `FAIL`, `N/A — capability/platform does not apply`, or `UNVERIFIED`.

Mock-only tests must never count as proof of authentication, ownership, persistence, sync, or RLS.

## 8. Design review versus screenshot regression

Generated mockups and application screenshots can differ in fonts, viewport, safe areas, device controls, data state, platform version, and animation state.

Use design review for layout, hierarchy, copy, spacing, states, interactions, and platform conventions. After implementation, create a reviewed actual-render baseline with fixed viewport/device, versions, test data, animation behavior, tolerances, and approval. Compare future builds against that baseline rather than directly against generated mockups.

## 9. Canonical paths and terminal states

Choose one test manifest location. Recommended: `tests/07_TEST_MANIFEST.md`. Update the README, project builder, global rules, orchestrator, QA, deployment, and architecture-reviewer skills.

Add a terminal handoff pointer:

```text
NEXT_STEP_POINTER: COMPLETE — USER MANAGED HANDOFF
```

Retain explicit statuses:

```text
Release: [SKIPPED — USER MANAGED]
Database: [SKIPPED — MOCKS ONLY]
```

Centralize autonomy gates and status vocabulary in `GLOBAL_RULES.md`. Include `N/A — CAPABILITY NOT REQUIRED` and `UNVERIFIED — DEPENDENCY DEFERRED`.

## Files expected to change

- `README.md`
- `.agents/rules/GLOBAL_RULES.md`
- `.agents/rules/PROJECT_CONTRACT.md`
- `.agents/skills/PROJECT_BUILDER_SKILL.md`
- `.agents/skills/it_consultant/SKILL.md`
- `.agents/skills/product_owner/SKILL.md`
- `.agents/skills/techincal_architect/SKILL.md`
- `.agents/skills/orchestrator/SKILL.md`
- `.agents/skills/frontend_developer/SKILL.md`
- `.agents/skills/service_engineer/SKILL.md`
- `.agents/skills/architecture_reviewer/SKILL.md`
- `.agents/skills/qa_agent/SKILL.md`
- `.agents/skills/deployment/SKILL.md`

## Implementation sequence

1. Workflow contract, applicability, authoritative statuses, and revision-aware resume.
2. Agent inputs, traceability, task ownership, prerequisites, and evidence.
3. Scoped permissions, tenant boundaries, account switching, atomic outbox, idempotency, retries, replay, and migrations.
4. Web/native rules, design review, screenshot baselines, and accessibility evidence.
5. Canonical paths, terminal handoff states, and cross-file consistency review.

## Preserve

Keep mandatory mockup approval, database configure-or-skip with disclosed mocks, deployment choose-or-skip with no deployment on skip, concrete release-plan approval, secret isolation, pluggable EAS/Vercel/custom providers, and logging/monitoring exclusion.

## Resume instruction

When ready, ask: `Apply PM_SKILL_UPGRADE_REPORT.md, excluding the controlled pilot.`
