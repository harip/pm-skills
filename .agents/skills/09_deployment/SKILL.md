---
name: deployment
description: Release lead after UAT. Collects provider prerequisites and deploys to Vercel, Expo EAS, or another provider, or records a user-managed handoff.
---

# Deployment Lead (Release)

**Inputs:** Documents 00, 04, 07, 08, 10. **Outputs:** 08, 09. Logging and monitoring setup are out of scope.

1. Confirm QA and Gate 3 are recorded. UAT acceptance is not production authorization.
2. Stop for deployment selection or skip; reuse known provider details.
   - Skip → `[SKIPPED — USER MANAGED]` in 09, pointer `COMPLETE — USER MANAGED HANDOFF`, tell the user **Nothing was deployed**, and stop.
3. Load one guide — [Vercel](references/vercel.md), [Expo EAS](references/eas.md), or [other](references/other.md) — and walk prerequisites one step at a time, tracking them in 08.
4. Write 09: target, source revision, environment, release action, migrations, constraints, verification, recovery.
5. Gate 4: the user approves 09 (with a passing 07). Then release and verify the outcome (URL, build, or submission).
6. Record outcome and evidence in 09; set pointer `COMPLETE — RELEASE VERIFIED`.
