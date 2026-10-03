# Expo EAS guided setup

Check current [build setup](https://docs.expo.dev/build/setup/), [CLI commands](https://docs.expo.dev/eas/cli/), and [submission setup](https://docs.expo.dev/submit/introduction/) before showing commands. Explain relevant Expo quotas and Apple/Google account requirements before the user chooses a distribution route.

1. Offer **iOS**, **Android**, **Both**, then the applicable destination: **Internal test build**, **TestFlight** (iOS), **Store submission**, or **Update an existing app**. Ask only applicable follow-ups; do not default to publishing both platforms.
2. Inspect `package.json`, Expo app configuration, and `eas.json`. Give one command at a time from the app directory:
   - `npx eas-cli@latest login` — user authenticates directly with Expo.
   - `npx eas-cli@latest whoami` — verify the expected account.
   - `npx eas-cli@latest init` — link/create the Expo project only if it is not linked.
   - `npx eas-cli@latest build:configure` — configure selected build profiles if missing.
   Initial login/configuration may be interactive. Use `--non-interactive` only for supported automation commands after required setup is complete.
3. Discover or request the project owner, selected platform's bundle/package identifier, build profile, and distribution destination. Guide users through signing credentials in the provider's own workflow. For TestFlight/iOS submission, guide Apple Developer/App Store Connect setup and the app record; for Android submission, guide Play Console and its required credentials/initial setup. Do not ask for passwords, signing keys, or service-account JSON in chat.
4. Guide required environment values into Expo's appropriate environment settings. Public client variables are embedded in the application; database passwords and privileged API keys must stay on the backend. Validate dependency compatibility and show proposed fixes before making unrelated dependency changes.
5. Prepare the applicable command with resolved non-secret placeholders:
   - Native build: `npx eas-cli@latest build --platform <ios|android|all> --profile <profile>`.
   - Submission of the verified build: `npx eas-cli@latest submit --platform <ios|android> --id <build-id>`; avoid ambiguous `--latest`.
   - OTA only when an installed build has compatible runtime/update configuration: follow [EAS Update setup](https://docs.expo.dev/eas-update/getting-started/) and prepare `npx eas-cli@latest update --channel <channel> --environment <environment> --message <message>`. A JavaScript-only change alone does not prove OTA compatibility.
6. Get release authorization before the selected publish/submission action. Record the exact build/update/submission identifier and verify the selected destination. A completed EAS build is not a store release; TestFlight processing and store review may still be pending. If user-only installation or store action is required, offer **Done — check it** / **Help** / **Later** and retain that next step.
