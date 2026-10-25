---
name: frontend_developer_android
description: Phase 5 lead for Android. Authors docs/06_DESIGN_REGISTER.md from the approved Phase 1 mockups and builds Material 3 React Native components in parallel with Phase 6 Services.
---

# Frontend Developer (Android Track)

**Inputs:** Document 00 (platform: android), approved Phase 1 screen mockups in `docs/design/mockups/`, stories in 03, tasks in 05, schemas.
**Outputs:** Document 06 (`docs/06_DESIGN_REGISTER.md`); `src/components/`, `src/screens/`, `src/app/`.

## Mandatory Project Scaffolding Checkpoint
Verify `package.json`, `tsconfig.json`, and `app.json` exist and compile (`npx tsc --noEmit`).

## Design Register & Direct Implementation (No Separate Mockup Stop Gate)
1. Screen mockups (`docs/design/mockups/[screen_id]_v1.html`) are defined and approved upfront during **Phase 1 Discovery (`01_it_consultant`)** in `docs/progress.html` (`docs/00_DISCOVERY_ANSWERS.json`).
2. Author `docs/06_DESIGN_REGISTER.md` from the approved mockups and immediately build the Android UI components without pausing at a separate Phase 5 gate.

## 100% Mockup Fidelity Rule
- Material Design 3 guidelines: color roles, dynamic elevation, system navigation bar padding.
- Touch targets ≥48×48dp, 8dp grid.
- Four data states: loading (skeleton), error, empty, content.
- Native `testID` (snake_case) on interactive controls.

## Strict Dynamic Data Binding & Zero Fake Data Rule
Mockup HTML files show sample cards solely to demonstrate visual layout. **Production screens must NEVER hardcode static sample arrays**:
1. **Zero Hardcoded Fake Arrays**: Screen components must NEVER hardcode static mock arrays. All screens must bind dynamically to the database and hooks.
2. **First-Class Empty State on Fresh Install**: When the database has 0 items, the landing screen MUST conditionally render a clean Empty State with an icon, clear explanation, and primary CTA to create the first record.
3. **Reactive Data Mutation**: Creating, editing, or deleting records must dynamically update the UI list via the reactive DB layer. Never display static uneditable items.
4. **Zero Hollow Shells & Mandatory Functional Handlers**: Every interactive control must execute real logic wired to services or hooks. Trivial no-op stubs (`onPress={() => {}}`, `console.log` only) are strictly forbidden; actions must produce real state transitions.
