---
name: deployment
description: Guide interactive deployment setup after QA and UAT, collect provider prerequisites, and release to Vercel, Expo EAS, or a user-selected provider.
---

# Deployment Lead (Final Release Step)

Keep conversation response terse, condensed, and clear. Use canonical document IDs from Global Rules; they do not define phase order.
Follow `.agents/rules/GLOBAL_RULES.md`, including the canonical phase order and autonomy gates. Release follows Phase 8 UAT and is not a numbered phase. Logging and monitoring setup are out of scope.

## Entry and Provider Selection
1. Read `docs/00_PROJECT_CONTRACT.md` (Document 00), `tests/07_TEST_MANIFEST.md` (Document 07), `docs/10_UAT_CHECKLIST.md` (Phase 8 UAT sign-off), `docs/04_TECHNICAL_SPEC.md` (Document 04), and `docs/08_SETUP_REGISTER.md` (Document 08).
2. Confirm QA and Gate 3 UAT acceptance are recorded, preserving any mock-only qualification. Stop for deployment selection/skip; reuse known provider details. UAT acceptance is not production authorization.
3. If deployment is skipped, record `[SKIPPED — USER MANAGED]` in `docs/09_RELEASE_PLAN.md` (Document 09), set `NEXT_STEP_POINTER: COMPLETE — USER MANAGED HANDOFF`, state **Nothing was deployed**, and stop deployment work.
4. Otherwise, load provider guide ([Vercel](references/vercel.md), [Expo EAS](references/eas.md), or [another provider](references/other.md)) and guide prerequisites one step at a time.

## Prepare, Release, Verify
- Track target progress in `docs/08_SETUP_REGISTER.md` (Document 08).
- Prepare `docs/09_RELEASE_PLAN.md` (Document 09) with target, source revision, environment, release action, migrations, constraints, verification, and recovery steps.
- Gate 4 requires user approval of `docs/09_RELEASE_PLAN.md` (Document 09) alongside passing `tests/07_TEST_MANIFEST.md` (Document 07).
- After authorization, execute release steps and verify outcome (preview/live URL, build, or submission).
- Record outcome and evidence in `docs/09_RELEASE_PLAN.md` (Document 09). On verified completion use the release terminal pointer from Global Rules; a deployment skip uses the user-managed handoff pointer.

## Inputs & Outputs
- **Inputs:** `docs/00_PROJECT_CONTRACT.md` (Document 00), `tests/07_TEST_MANIFEST.md` (Document 07), `docs/10_UAT_CHECKLIST.md` (Phase 8 UAT sign-off), `docs/04_TECHNICAL_SPEC.md` (Document 04), `docs/08_SETUP_REGISTER.md` (Document 08).
- **Outputs:** `docs/09_RELEASE_PLAN.md` (Document 09), `docs/08_SETUP_REGISTER.md` (Document 08).
- **Chat Output:** Short summary + link `[docs/09_RELEASE_PLAN.md](file://...)`.
