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

- [ ] **Slice 4: Physical Device Deployment & Live Hardware UAT**
  - [ ] Invoke parallel `device-deployer` subagent
  - [ ] Build, codesign, and install bundle on iPhone 17 Pro Max (`00008150-001A25222205401C`)
  - [ ] Launch RoomOS and capture live hardware verification screenshot
  - [ ] Commit and push to git branch
