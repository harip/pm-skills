# Interactive database setup (Phase 6, Step 0)

Run when backend work begins, before implementing provider-dependent integration. Follow the Interactive Setup rules in `.agents/rules/GLOBAL_RULES.md`. Logging and monitoring services are outside this flow.

## Choose
- Inspect the technical spec and existing non-secret configuration. Honor an existing explicit selection; defaults in a generated brief are recommendations, not a user selection. Always stop at this checkpoint: if configured already, offer **Use existing setup — verify**, **Change setup**, **Skip database — use mocks**, without asking for known details again.
- Present **Supabase Free (Recommended)**, **Use an existing database**, **Another provider**, and **Skip database — use mocks** with an available structured choice tool (split into a follow-up choice if the tool limits option count). Offer **Set up later** separately in progress controls. If the app explicitly needs no remote backend, record that decision and skip cloud setup.
- Verify [Supabase pricing](https://supabase.com/pricing) and [billing documentation](https://supabase.com/docs/guides/platform/billing-on-supabase) at setup time. Explain the relevant free-plan limits briefly; do not promise unlimited or permanent free service or silently choose a paid plan. If the free offering has changed, find a suitable verified free option before recommending it.

## Supabase prerequisites, one step at a time
1. Link to the [Supabase dashboard](https://supabase.com/dashboard). Ask the user to sign in, select/create an organization, and create a project on the Free plan. Offer **Done — check it**, **Help**, **Later** after each user action.
2. Guide project name, region, and database-password creation in the dashboard. The password stays in their password manager/provider workflow, never in chat or the setup register. Wait until the project is ready.
3. Ask for the project reference and URL only if unavailable locally. Determine required variable names from the chosen architecture. For client SDK use, guide the publishable key and URL; for server connections/migrations, guide the appropriate connection string from the project's Connect panel. Consult [connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres) and [API key guidance](https://supabase.com/docs/guides/api/api-keys).
4. Create a placeholder-only `.env.example`; ensure actual local environment files are ignored before the user enters values in their editor. For hosted environments, direct entry belongs in the provider's secret settings. Ask **Values added — verify** instead of requesting the values in chat. Privileged keys and connection strings must never enter browser/mobile bundles or public-prefixed environment variables.
5. Verify required variables are present without printing values, then run a non-destructive connection check for the application's actual access path. Verify server connectivity and/or client access with the intended authorization, as applicable; a reachable public endpoint alone is insufficient. Report sanitized success/failure, and guide the specific fix if it fails.
6. Record readiness in `docs/08_SETUP_REGISTER.md`: selected provider/plan/project/region, prerequisites, variable names and storage locations, check evidence, next action. Update affected technical-spec assumptions and hand off to backend implementation. Connection readiness does not mean migrations or RLS are implemented; those remain engineering and QA obligations.

## Existing or different database
Ask for provider/type and environment, then use current official instructions to collect only missing prerequisites. Preserve existing data; prepare schema changes as migrations and obtain applicable approval before applying them. If the choice changes auth, storage, or sync assumptions, reconcile the technical spec before implementation. Do not silently replace it with Supabase.

## Waiting and resumption
Missing choices, authentication, values, or failed checks keep setup open in every autonomy mode. Save the next action and allow independent mock/local work to continue. Resume at the first incomplete prerequisite, without re-asking completed choices. Never mark backend integration verified from the user's Done button alone.


## Explicit skip: continue with mocks
At the database checkpoint the user may choose **Skip database — use mocks**, including when they plan to configure their own backend later. Record `[SKIPPED — MOCKS ONLY]` and the outstanding integration checklist in `docs/08_SETUP_REGISTER.md`. Continue building typed models/contracts, validated fixtures, and a clearly selected mock adapter; never silently fall back to mocks on a real connection error. Do not imply that records persist remotely, auth is secured, or sync works.

Tell the user immediately: **Database setup skipped. This app uses mock data. Come back to connect the database and complete persistence, authentication/permissions, sync, and real-backend tests before production use.** Include the outstanding work again at final handoff. Keep mock mode explicit in app configuration and user-facing demo labeling where needed to avoid implying data is saved. QA can verify mock-backed behavior but must mark real-backend/security checks unverified. Resume database setup when requested, replace the mock adapter, and rerun affected checks before clearing the debt.
