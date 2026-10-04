# Capability-Based Project Contract Protocol

## Overview
Phase 1 creates `docs/00_PROJECT_CONTRACT.md` to define explicit project capabilities and targets. Downstream agents inspect this contract and adapt execution. Agents MUST NOT add infrastructure (databases, auth, sync queues, RLS, IDOR tests) if the capability is marked `none`.

## Contract Schema (`docs/00_PROJECT_CONTRACT.md`)
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

## Value Definitions
- `required`: Capability is active; full verification and tests required before release.
- `none`: Capability N/A. Downstream checks marked `N/A — capability not required`. Agents skip unneeded layers.
- `deferred`: Capability uses mocks temporarily. Status marked `UNVERIFIED — DEPENDENCY DEFERRED`. Production deployment BLOCKED until resolved or explicitly skipped.

## Capability Matrix Enforcement
| Capability Flag | Value = `none` Behavior |
|---|---|
| `authentication` | Skip login screens, JWT managers, `AuthContext`, 401 tests. |
| `persistence` | Skip database schemas, ORM adapters, migrations, cloud DB setup. |
| `offline_writes` | Skip sync engine outbox, queue retry workers, tombstones. |
| `shared_records` | Simple creator ownership (`createdBy`). Skip tenant/team boundary checks. |
| `backend` | Frontend-only / static build. Skip backend service engineering. |

## Decision Evidence
Alongside the capability YAML, maintain `Decision | Value | Confirmed/Assumed | Source | Open question`. Keep this metadata separate from capability enum values. Never classify an uncertain essential capability as `none` simply to bypass work. Resolve consequential uncertainty using the scope clarification rules in Global Rules, update affected stories, and invalidate dependent approvals when a decision changes.
