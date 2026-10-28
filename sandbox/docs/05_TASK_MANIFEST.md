# 05 Task Manifest: LiDAR Room & Whole-House 3D Studio (iOS)

## Foundation Prerequisites
- **DEV-001**: iOS Project Scaffolding & Configuration
  - Files: `sandbox/package.json`, `sandbox/tsconfig.json`, `sandbox/app.json`
  - Dependencies: `expo`, `react`, `react-native`, `react-native-svg`, `expo-sqlite`, `expo-sharing`, `expo-file-system`, `expo-haptics`
  - Success Criterion: `npx tsc --noEmit` runs with 0 errors.

---

## Phase 5 & 6 Parallel Work Breakdown
- **DEV-002 (Database & Services)**:
  - Prerequisite: `DEV-001`
  - Files:
    - `sandbox/src/types/room.ts`, `furniture.ts`, `house.ts`
    - `sandbox/src/db/schema.ts`, `sandbox/src/db/database.ts`
    - `sandbox/src/services/scannerService.ts` (LiDAR & universal simulation fallback)
    - `sandbox/src/services/geometryService.ts` (3D/2D projection & dimension conversion)
    - `sandbox/src/services/stitchEngine.ts` (Doorway matching & composite calculation)
    - `sandbox/src/services/stlExporterService.ts` (Watertight STL mesh export)
  - Success Criterion: Unit tests execute and verify database CRUD, mesh math, and STL generator.

- **DEV-003 (Frontend UI Screens - Apple HIG Light Mode Only)**:
  - Prerequisite: `DEV-001`
  - Files:
    - `sandbox/src/screens/RoomsCatalogScreen.tsx` (Empty-state-first, sample toggle, cards)
    - `sandbox/src/screens/LidarScannerScreen.tsx` (Full-bleed 3D viewport, orbit drag, live tags)
    - `sandbox/src/screens/RoomStudioScreen.tsx` (3D Solid Mesh, 2D Floor Plan, ft/m switcher, STL download)
    - `sandbox/src/screens/WholeHouseStitchScreen.tsx` (Multi-room chips, doorway alignment)
    - `sandbox/App.tsx` (Navigation router with Apple HIG tab/stack bar)
  - Success Criterion: Strict Apple HIG Light Mode styling (`#f5f5f7` canvas, `#ffffff` cards, SF Pro typography), dynamic binding to `DEV-002`, zero dark mode.

---

## Phase 7 & 8 Verification Breakdown
- **DEV-004 (QA Testing & Validation)**:
  - Prerequisite: `DEV-002`, `DEV-003`
  - Files: `sandbox/src/__tests__/app.test.tsx`
  - Verification: Mutation testing of user interactions (`fireEvent.press` on scan, save, toggle, and export).
- **DEV-005 (Target-Platform UAT Preparation)**:
  - Prerequisite: `DEV-004`
  - Output: `sandbox/docs/10_UAT_CHECKLIST.md` and live Expo preview verification.
