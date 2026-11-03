# Spatial Capture Engine: Implementation Task Tracker

## Active Milestone: SLICE 1 (Native Swift Math Engine)
- Target File: `sandbox/ios/LiDARRoomStudio/RoomGeometryOptimizer.swift`
- Verification Command: Compilation check via `xcodebuild`
- Exit Gate: 0 compiler warnings, 0 syntax errors.

---

## Master Checklist

- [x] **Slice 1: Native Swift Math Engine**
  - [x] Implement `Point2D` and `RawSegment` structures with `SIMD2<Double>`
  - [x] Implement Length-Weighted Modulo-90 Circular Mean for $\theta_{\text{dom}}$
  - [x] Implement Dual-Threshold Angular Quantization (Orthogonal / 45° Bay / Custom)
  - [x] Implement Constrained Orthogonal Least-Squares line projection ($A x + B z + C = 0$)
  - [x] Implement Collinear segment fusion (LiDAR dropout repair)
  - [x] Implement Determinant-guarded line-line intersection ($\det \to 0$ guard)
  - [x] Implement Shoelace polygon area & perimeter metrics
  - [x] Verify clean compilation in Xcode

- [x] **Slice 2: Native Test Harness & Parity Verification**
  - [x] Run 10-Case stress battery in test runner
  - [x] Run 31/31 unit test suite (`npm test`)
  - [x] Run automated fixture test runner (`npm run test:fixture`)
  - [x] Verify 100% test pass rate

- [x] **Slice 3: Safe Controller Hook & Opening Kinematics**
  - [x] Extract raw walls, doors, windows, and openings in `RoomCaptureViewController.swift`
  - [x] Feed wall centerlines into `RoomGeometryOptimizer.solve(rawSegments)`
  - [x] Apply Parent-Child Kinematic Transformation to update doors, windows & openings
  - [x] Implement Try-Catch Fallback Guard (graceful degradation to raw RoomPlan on error)
  - [x] Generate clean watertight `mesh_json` and pass to React Native bridge

- [x] **Slice 4: Physical Device Deployment & Live Hardware UAT**
  - [x] Invoke parallel `device-deployer` subagent
  - [x] Build, codesign, and install bundle on iPhone 17 Pro Max (`00008150-001A25222205401C`)
  - [x] Launch RoomOS and capture live hardware verification screenshot
  - [x] Commit and push to git branch (Commit 1f155d7)

- [x] **Slice 5: React Native GeometryService (OM-TLC) & Studio 3D Pipeline Integration**
  - [x] Port complete OM-TLC pipeline to `GeometryService.buildRoomPolygon` (cyclic chaining, length-weighted circular mean, dual-threshold angle quantization, collinear wall fusion, determinant-guarded line intersections)
  - [x] Integrate `parsedMesh.polygon` preference with `isWatertight` verification into `RoomStudioScreen.tsx`, `RoomsCatalogScreen.tsx`, `HouseAssemblyScreen.tsx`, and `stlExporterService.ts`
  - [x] Add regression test `EVAL-24` in `test-runner.js` verifying collinear back wall fusion and bent wall elimination on real scanned device data
  - [x] Verify full test battery (32/32 tests PASS, 2/2 fixture tests PASS, 10/10 Python stress tests PASS, 0 TypeScript errors)
