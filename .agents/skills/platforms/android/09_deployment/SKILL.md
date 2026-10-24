---
name: deployment_android
description: Release lead for Android. Builds AAB packages via EAS or configures Google Play Console distribution.
---

# Deployment Lead (Android Track)

**Inputs:** Documents 00, 04, 07, 08, 10. **Outputs:** 08, 09.

## Release Distribution Paths
1. **User-Managed Handoff (Recommended Default)**:
   - Sets `[SKIPPED — USER MANAGED]` in Document 09.
   - Complete project delivered in repository.
2. **Expo EAS Android Cloud Build**:
   ```bash
   npx eas-cli build --platform android --profile production
   npx eas-cli submit --platform android --latest
   ```

## Gate 4 Review
User approves Document 09 (`docs/09_RELEASE_PLAN.md`). Concludes release with verified handoff or build artifact.
