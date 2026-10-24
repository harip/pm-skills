# Staging & Cloud Preview Reference for UAT

Use this reference when the stakeholder or developer selects **Option 4: Staging / Cloud Preview** for pre-production verification.

---

## 1. Overview
Staging previews deploy the release candidate to a preview URL (e.g. Vercel Preview, Netlify Deploy Preview, or dedicated staging environment) connected to staging/test databases.

---

## 2. Interactive Discovery
1. Ask the user:
   - *"Do you have an existing staging URL or would you like to generate a preview deployment (e.g., via Vercel Preview CLI)?"*
2. If using existing staging:
   - Request the staging URL (e.g., `https://staging.myapp.com`).
3. If generating a Vercel Preview build:
   - Run:
     ```bash
     npx vercel
     ```
   - (Inspect output for the generated preview URL `https://myapp-<hash>.vercel.app`).

---

## 3. Environment Variables & Safety
- Staging environments must connect to **test / staging database instances**, never production databases containing live user data.
- Ensure any local staging overrides are kept in `.env.local` or provider project dashboard secrets.

---

## 4. Checklist Recording
Record in `docs/10_UAT_CHECKLIST.md`:
- **Environment:** Cloud Staging URL (`<staging-url>`)
- **Revision / Commit:** Git commit hash or preview deployment ID
- **Data Mode:** Staging database / isolated test tenant
