# Vercel guided setup

Use for a selected web target. Verify current commands and plan eligibility against [CLI deployment](https://vercel.com/docs/projects/deploy-from-cli) and [plans](https://vercel.com/docs/plans) before presenting them. Do not assume a free plan suits the user's intended use.

1. Offer **Use existing project** / **Create project**, then **Preview** / **Production**. Reuse known answers. Ask for account/team and project only if not discoverable. An optional custom domain can wait; a provider URL is sufficient.
2. Give these commands individually from the app directory, explaining the expected result:
   - `npx vercel login` — user completes provider authentication.
   - `npx vercel link` — user selects the correct scope and project. Verify `.vercel/project.json` identifiers without showing credentials.
3. Inspect framework/build settings and required environment variable names. Guide the user to Project Settings → Environment Variables and select Preview/Production as appropriate. Let them enter secret values directly there. Use ignored local environment files only when needed for local verification; never print their contents. Commit only placeholder examples.
4. Check database/backend endpoints and server-only versus public variables. A separate API/worker needs its own supported host and setup; linking the frontend does not deploy it automatically. Confirm required backend prerequisites before releasing a dependent frontend.
5. Validate the build. Show `npx vercel` for the selected preview or `npx vercel --prod` for production as the planned publish command. Execute only within the authorized scope after the release plan is ready. CLI deployment does not require a Git push; offer Git integration only if requested.
6. Verify the returned deployment status and URL, a core page, and required backend connectivity without exposing user data. Record the URL and evidence. If domain configuration was requested, guide DNS changes and verify separately. Include a documented recovery path to a known good release when one exists.
