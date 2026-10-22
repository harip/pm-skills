# Another deployment provider

Ask for the provider name or official documentation link, then guide the same interactive setup flow. Read current official documentation; never guess login or production commands.

Determine whether the provider supports the actual artifact/runtime, then discover or ask for account/project, environment, build settings, secret storage, and destination. Present only the prerequisites relevant to that provider, one step at a time, with dashboard links or copyable commands. Record the checklist and sources in `docs/08_SETUP_REGISTER.md`.

If the provider requires architectural changes, explain their effect and update the technical spec and affected checks before release. If documentation or access is unavailable, record the exact blocker and offer **Provide documentation**, **Choose another provider**, **Later**; do not claim deployment is configured.

Prepare the concrete release plan, obtain applicable authorization, deploy, and verify using the main deployment skill. Reusable provider support can later be added as a reference file linked from that skill; do not install new tooling or create accounts just to register a provider option.
