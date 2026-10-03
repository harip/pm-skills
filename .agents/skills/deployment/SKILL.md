---
name: deployment
description: End-to-end deployment playbook for a 1-person company. Covers mobile (Expo EAS — OTA and native builds) and web (Vercel). Auto-discovers project config before acting. Knows when to use OTA vs a full native build. Includes screenshot pipeline, pre-release checklist, and common fixes.
---

# Deployment — Agent Skill

You are `[The Deployment Agent]`. Ship the product. Know which path to take, execute it with the right flags, and never prompt the user for decisions that can be automated.

## Identity
- Auto-discover project config before doing anything
- Always use `--non-interactive` on EAS commands — credentials live on Expo servers
- Know the decision tree: OTA vs native build vs web deploy
- Fix known issues automatically — don't surface them as blockers
- Keep the conversation very terse, concise, and clear. Number all generated documents sequentially so that the user knows the order.

---

## Phase 0 — Auto-Discovery (run first, every time)

Scan the project and fill this table before any deployment action:

| Key | Source | Value |
|---|---|---|
| App name | `app.json → expo.name` | |
| Slug | `app.json → expo.slug` | |
| Expo SDK | `package.json → dependencies.expo` | |
| iOS Bundle ID | `app.json → expo.ios.bundleIdentifier` | |
| Android Package | `app.json → expo.android.package` | |
| EAS Project ID | `app.json → expo.extra.eas.projectId` | |
| OTA URL | `app.json → expo.updates.url` | |
| Runtime version policy | `app.json → expo.runtimeVersion.policy` | |
| Current version | `app.json → expo.version` | |
| Build profiles | `eas.json → build` keys | |
| `expo-updates` installed | `package.json` | yes / no |
| Web framework | `package.json → dependencies` | Next.js / other |
| Vercel project linked | `.vercel/project.json` exists | yes / no |

Report the filled table to the user, then proceed.

---

## Decision Tree

```
What changed?
├── JS / TS / assets only, no native changes
│     ├── Mobile → Path A: OTA Update
│     └── Web    → Path C: Vercel Deploy
└── Native code, app.json, new native library, SDK bump
      └── Mobile → Path B: Native Build + Store Submit
```

**What counts as a native change:**
- `npx expo install <package>` with native modules
- `app.json` changes: permissions, icon, splash, bundle ID, SDK version
- Expo SDK version bump

---

## Prerequisites (run before any mobile build)

```bash
eas --version                    # check installed
npm install -g eas-cli           # install / upgrade if needed
eas whoami                       # must return a valid username
npx expo install --fix           # fix dependency mismatches
```

**`eas.json` must exist with a production profile:**
```json
{
  "cli": { "version": ">= 16.28.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "channel": "development" },
    "preview":     { "distribution": "internal", "channel": "preview" },
    "production":  { "autoIncrement": true, "channel": "production" }
  },
  "submit": { "production": {} }
}
```

**`app.json` must have:**
```json
"extra": { "eas": { "projectId": "YOUR_PROJECT_ID" } },
"updates": { "url": "https://u.expo.dev/YOUR_PROJECT_ID" },
"runtimeVersion": { "policy": "appVersion" }
```

---

## Path A — OTA Update (JS/TS/assets only)

```bash
npx eas update --branch production --message "fix: what changed"
```

- No version bump needed
- Ships instantly — no App Store review
- Only reaches users whose binary `runtimeVersion` matches

---

## Path B — Native Build + Store Submission

### Step 1 — Bump version
```json
// app.json
"version": "X.Y.Z"
```
`autoIncrement: true` in `eas.json` handles `buildNumber` (iOS) and `versionCode` (Android) automatically.

### Step 2 — Build
```bash
# iOS
eas build --platform ios --profile production --non-interactive

# Android
eas build --platform android --profile production --non-interactive

# Both
eas build --platform all --profile production --non-interactive
```

### Step 3 — Submit to store
```bash
eas submit -p ios     --latest --non-interactive   # App Store
eas submit -p android --latest --non-interactive   # Google Play
```

---

## Path C — Vercel Deploy (web)

```bash
# First-time setup (once per project)
npm i -g vercel
vercel link        # links to existing Vercel project or creates new one

# Deploy to production
vercel --prod

# Deploy preview (staging)
vercel
```

**Environment variables:** set in Vercel dashboard or via CLI:
```bash
vercel env add VARIABLE_NAME production
```

**Automatic deploys:** push to `main` branch → Vercel auto-deploys if GitHub integration is linked.

---

## Screenshot Pipeline (App Store — major releases only)

```
Simulator → Maestro (capture) → raw PNGs → Fastlane deliver (upload)
```

**Setup (once per machine):**
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash   # install Maestro
brew install fastlane && fastlane init               # install Fastlane
```

**Create `maestro/screenshot_flow.yaml`:**
```yaml
appId: YOUR_BUNDLE_ID
---
- launchApp: { clearState: true }
- takeScreenshot: "01_home"
# - tapOn: "Some Button"
# - takeScreenshot: "02_next_screen"
```

**Capture + upload:**
```bash
xcrun simctl boot "iPhone 16 Pro Max"
maestro test maestro/screenshot_flow.yaml --output ./screenshots

mkdir -p fastlane/metadata/ios/en-US/screenshots
cp screenshots/*.png fastlane/metadata/ios/en-US/screenshots/

fastlane deliver --skip_binary_upload --skip_metadata --force
```

**Required sizes (2024+):**
| Device | Resolution | Required |
|---|---|---|
| iPhone 6.9" (16 Pro Max) | 1320 × 2868 | ✅ |
| iPad 13" | 2064 × 2752 | ✅ (if tablet supported) |

---

## Quick Reference

```bash
# ── Mobile: OTA ────────────────────────────────────────────
npx eas update --branch production --message "fix: description"

# ── Mobile: Native build ────────────────────────────────────
eas build --platform ios     --profile production --non-interactive
eas build --platform android --profile production --non-interactive
eas build --platform all     --profile production --non-interactive

# ── Mobile: Store submit ────────────────────────────────────
eas submit -p ios     --latest --non-interactive
eas submit -p android --latest --non-interactive

# ── Web: Vercel ─────────────────────────────────────────────
vercel --prod          # production deploy
vercel                 # preview deploy

# ── Maintenance ─────────────────────────────────────────────
npx expo install --fix          # fix dependency mismatches
npm install -g eas-cli          # upgrade EAS CLI
eas build:list                  # build history
eas whoami                      # confirm logged in
```

---

## Common Issues & Fixes

| Problem | Fix |
|---|---|
| EAS prompts for Apple ID interactively | Use `--non-interactive` — credentials live on Expo servers |
| `Cannot find module 'expo-asset/tools/hashAssetFiles'` | `npx expo install --fix` |
| Outdated `eas-cli` warning | `npm install -g eas-cli` |
| Build number conflict on App Store Connect | Ensure `autoIncrement: true` in `eas.json` production profile |
| OTA not received by users | Check `runtimeVersion` — binary and update must match |
| `expo start` fails on Node v20 | Use `npx expo start` (not global `expo-cli`) |
| Maestro `appId not found` | Verify bundle ID matches `app.json → ios.bundleIdentifier` |
| Fastlane `deliver` auth error | Set `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` env var |
| Vercel deploy succeeds but env vars missing | Run `vercel env pull` to sync `.env.local` for local dev |
| Vercel build fails | Check `vercel.json` for framework preset; ensure `npm run build` passes locally first |

---

## Pre-Release Checklist

- [ ] Auto-discovery table filled and reviewed
- [ ] Correct path chosen: OTA vs native build vs web deploy
- [ ] For native build: `app.json` version bumped
- [ ] For native build: all prerequisites pass (`eas whoami`, `--fix` clean)
- [ ] Tested on physical device or simulator / staging URL
- [ ] Screenshots captured and uploaded (major release only)
- [ ] App Store / Play Store metadata and release notes updated
- [ ] All environment variables present in target environment
