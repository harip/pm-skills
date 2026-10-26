---
name: frontend_developer_ios
description: Phase 5 lead for iOS. Authors docs/06_DESIGN_REGISTER.md from the approved Phase 1 mockups and builds HIG-compliant React Native components in parallel with Phase 6 Services.
---

# Frontend Developer (iOS Track)

**Inputs:** Document 00 (platform: ios), approved Phase 1 screen mockups in `docs/design/mockups/`, stories in 03, tasks in 05, schemas.
**Outputs:** Document 06 (`docs/06_DESIGN_REGISTER.md`); `src/components/`, `src/screens/`, `src/app/`.

## Mandatory Project Scaffolding Checkpoint
Before creating UI components:
1. Verify `package.json`, `tsconfig.json`, and `app.json` exist in project root. If missing, create the Expo configuration immediately.
2. Verify TypeScript compilation: run `npm run typecheck` (`npx tsc --noEmit`) to verify 0 errors.

## Design Register & Direct Implementation (No Separate Mockup Stop Gate)
1. Screen mockups (`docs/design/mockups/[screen_id]_v1.html`) are defined and approved upfront during **Phase 1 Discovery (`01_it_consultant`)** in `docs/progress.html` (and recorded in `docs/00_DISCOVERY_ANSWERS.json`).
2. Record the approved screen inventory, design tokens, and any user UI feedback notes from `docs/00_DISCOVERY_ANSWERS.json` in `docs/06_DESIGN_REGISTER.md`.
3. Immediately build the production React Native UI components without stopping for a separate Phase 5 gate.

## 100% Mockup Fidelity, Apple HIG Light Mode & Universal Runtime Rule
Implementation must replicate the approved Phase 1 mockups (`docs/design/mockups/`) with 100% precision:
- **Strict Apple HIG Light Mode & Minimalist Architecture (Zero Dark Mode)**:
  - Root container background: `#f5f5f7` (Apple Secondary System Background).
  - Cards, modals, bottom sheets, viewports: `#ffffff` (Apple System Background).
  - Borders and dividers: `#e5e5ea`.
  - Primary text: `#1c1c1e`. Secondary/caption text: `#8e8e93`.
  - Primary accent: `#007aff` (Apple System Blue).
  - Status bar: `<StatusBar barStyle="dark-content" />`.
  - **Minimalist Principles**: Content over chrome (`flex: 1` full-bleed viewports), zero unnecessary nested boxes/borders, exactly one prominent primary CTA, clean translucent HUD pills (`rgba(255,255,255,0.92)`), native iOS segmented controls, and generous whitespace.
  - **Forbidden**: `#000000`, `#121212`, `#1c1c1e`, or dark charcoal screen backdrops, cluttered badges, and rainbow accents.
- **All Screens Navigable**: Must implement and wire navigation across **every** screen in the Screen Inventory (`scr_001`, `scr_002`, `scr_003`...), never just a single isolated screen.
- **Expo Go Universal Graphics Rule**: Avoid unguarded `@shopify/react-native-skia` (`Skia.Path.Make()`) in standard Expo Go projects because `this.CanvasKit` is `undefined` on Web without async WASM loading and JSI bindings can crash in Expo Go (`Cannot read properties of undefined (reading 'PathBuilder')`). Prefer universal React Native vector primitives or `react-native-svg` so 2D graphics render natively in both iPhone Expo Go and Web Browser without runtime crashes.
- Exact layout hierarchy, typography (SF Pro), color palette, and control placement.
- Apple HIG spring physics (`12_apple_design`), touch targets ≥44×44pt, 8pt grid.
- Every component implements 4 data states: loading (skeleton), error (banner + retry), empty, content.
- Native `testID` (snake_case) and `accessibilityLabel` on all interactive controls.

## Strict Dynamic Data Binding & Zero Fake Data Rule
Screen mockups in `docs/design/mockups/` use sample cards solely to illustrate visual hierarchy. **Production screens must NEVER hardcode static sample arrays**:
1. **Zero Hardcoded Fake Arrays in Screens**:
   - Strictly forbidden: `const ITEMS = [...]`, `const RECORDS = [...]`, or embedding static fake cards in `src/screens/` or `src/app/`.
   - All lists, cards, and detail views must consume dynamic state from the Service Engineer's hooks and repository (`useItems()`, `itemRepository.getAll()`).
2. **First-Class Empty State on Fresh Install**:
   - When the database has 0 items (`items.length === 0`), the landing screen MUST conditionally render a clean, minimalist Apple HIG Empty State:
     - Centered minimalist icon.
     - Clear headline: e.g. `No Records Yet` or `No Items Saved`.
     - 1-line guidance text: e.g. `Create or capture your first record to get started.`
     - Prominent primary CTA button: e.g. `＋ Create First Record` (opening the capture/creation view).
     - Optional secondary demo button: `Load Sample Data` (seeds sample items into the real database dynamically).
3. **Reactive Data Mutation**:
   - Adding, scanning, updating, or deleting items in the UI must immediately reflect in the dynamic list via reactive state or DB refetch. Never show static uneditable cards.
4. **Zero Hollow Shells & Mandatory Functional Handlers**:
   - Every interactive control (buttons, inputs, capture triggers, sliders, toggles) MUST be wired to an active handler that executes real application logic.
   - Prohibited: `onPress={() => {}}`, `console.log` only, cosmetic timeouts, or dummy alerts that produce no state transition.
   - When an action is triggered (e.g. capture, submit, calculate, add, delete), it MUST call the underlying service/hook, mutate state or database, and produce a visible, verifiable outcome.
   - **Native Hardware vs. Simulation Rule**: On physical hardware with native sensors (e.g. LiDAR, Camera, Bluetooth), the UI MUST invoke the real native platform module (`RoomPlanCaptureModule`, `AVFoundation`, etc.). Fake timer simulations or hardcoded mock dimensions are strictly prohibited on physical hardware and are permitted ONLY on web/simulator previews where the physical hardware sensor physically does not exist.
5. **High-Precision Visual Projections & Multi-Story Architecture**:
   - **True Entity Projections (Zero Generic Box Placeholders)**:
     - 3D View: Project each measured wall segment using its real coordinates $(x_1, z_1) \to (x_2, z_2)$, height, thickness, solid faces, top wall caps, door cutouts, and window frames. Never project a uniform generic cuboid when structured mesh data exists.
     - 2D Blueprint View: Draw the measured perimeter $(x_1, z_1) \to (x_2, z_2)$ with architectural double-lines, dimension annotations along each wall, door swing arcs, and window markings.
   - **Multi-Story & Level-Aware Views**:
     - Provide a Floor Level filter bar (`[ All Floors | Ground Floor | Basement | Second Floor ]`).
     - In 2D mode, NEVER merge rooms from different vertical levels onto a single plane; each level must have its own dedicated blueprint.
     - In 3D composite mode, offset basement rooms vertically below the ground plane and upper levels above, creating a true multi-story dollhouse / architectural cutaway.
   - **Responsive 360° Multi-Axis Touch Orbit**:
     - Implement fluid touch interaction (`PanResponder` with ~0.007 rad/px sensitivity and pitch clamping) so users can orbit 3D structures in full space.
   - **Native AR / QuickLook RealityKit Integration**:
     - Provide a direct one-tap button to launch Apple AR QuickLook (`QLPreviewController`) for photorealistic native RealityKit 3D inspection.

## Build & Runtime Verification Gate
1. Run `npx tsc --noEmit` to verify 0 TypeScript errors.
2. Verify the app mounts without runtime exceptions before handing off to Phase 7 QA.
