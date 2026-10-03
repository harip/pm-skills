---
name: deployment
description: Guide interactive deployment setup after QA, collect provider prerequisites, and release to Vercel, Expo EAS, or a user-selected provider.
---

# Deployment Lead (Final Release Step)

Keep conversation response terse, condensed, and clear. All generated documents must be numbered to show execution order.
Follow `.agents/rules/GLOBAL_RULES.md`, especially Interactive Setup. Logging and monitoring setup are out of scope.

## Entry and Provider Selection
1. Read `docs/00_PROJECT_CONTRACT.md` (Document 00), `tests/07_TEST_MANIFEST.md` (Document 07), `docs/04_TECHNICAL_SPEC.md` (Document 04), and `docs/08_SETUP_REGISTER.md` (Document 08).
2. Stop at this checkpoint for provider choice unless pre-determined in `docs/00_PROJECT_CONTRACT.md`.
3. If deployment is skipped, record `[SKIPPED — USER MANAGED]` in `docs/09_RELEASE_PLAN.md` (Document 09), set `NEXT_STEP_POINTER: COMPLETE — USER MANAGED HANDOFF`, state **Nothing was deployed**, and stop deployment work.
4. Otherwise, load provider guide ([Vercel](references/vercel.md), [Expo EAS](references/eas.md), or [another provider](references/other.md)) and guide prerequisites one step at a time.

## Prepare, Release, Verify
- Track target progress in `docs/08_SETUP_REGISTER.md` (Document 08).
- Prepare `docs/09_RELEASE_PLAN.md` (Document 09) with target, source revision, environment, release action, migrations, constraints, verification, and recovery steps.
- Gate 3 requires user approval of `docs/09_RELEASE_PLAN.md` (Document 09) alongside passing `tests/07_TEST_MANIFEST.md` (Document 07).
- After authorization, execute release steps and verify outcome (preview/live URL, build, or submission).
- Record outcome and evidence in `docs/09_RELEASE_PLAN.md` (Document 09).

## Inputs & Outputs
- **Inputs:** `docs/00_PROJECT_CONTRACT.md` (Document 00), `tests/07_TEST_MANIFEST.md` (Document 07), `docs/04_TECHNICAL_SPEC.md` (Document 04), `docs/08_SETUP_REGISTER.md` (Document 08).
- **Outputs:** `docs/09_RELEASE_PLAN.md` (Document 09), `docs/08_SETUP_REGISTER.md` (Document 08).
- **Chat Output:** Short summary + link `[docs/09_RELEASE_PLAN.md](file://...)`.

