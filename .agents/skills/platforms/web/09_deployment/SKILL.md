---
name: deployment_web
description: Release lead for Web. Automates Vercel, Cloudflare, or Docker deployments.
---

# Deployment Lead (Web Track)

**Inputs:** Documents 00, 04, 07, 08, 10. **Outputs:** 08, 09.

## Release Distribution Paths
1. **User-Managed Handoff (Recommended Default)**:
   - Sets `[SKIPPED — USER MANAGED]` in Document 09.
   - Complete Next.js project delivered in repository.
2. **Vercel Production Deployment**:
   ```bash
   npx vercel --prod
   ```

## Gate 4 Review
User approves Document 09 (`docs/09_RELEASE_PLAN.md`). Concludes release with production URL or verified handoff.
