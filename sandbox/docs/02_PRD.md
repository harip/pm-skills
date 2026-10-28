# 02 Product Requirements Document: LiDAR Room & Whole-House 3D Studio (iOS)

## The Bet
Homeowners, architects, interior designers, and DIY renovators need an instant, highly accurate way to scan rooms, generate 3D meshes, inspect 2D architectural blueprints, test furniture fit, and stitch multi-room spaces into full houses without paying thousands for expensive hardware or complex CAD software.

## Users & Personas
- **Primary Persona**: Homeowner & Interior Enthusiast ("Sarah") — Wants fast, frictionless room measurement and furniture layout testing.
- **Secondary Persona**: Residential Contractor / Drafter ("Marcus") — Needs millimeter-precision 3D mesh exports (.STL/.OBJ) and 2D floor plans for CAD software.

## Goals
1. Provide instant 3D mesh scanning and real-time dimension detection.
2. Deliver a clean Apple HIG Light Mode user experience with zero dark mode and zero UI clutter.
3. Guarantee first-class empty states on fresh install with zero fake mock records in production databases.
4. Provide a universal functional simulation engine so every feature is 100% operable on any iPhone or simulator.
5. Enable 1-click CAD export (.STL) directly to local storage and native iOS share sheet.

## In Scope
- Realtime LiDAR scanning with point cloud visualization and simulation fallback.
- Live dimension callouts (W × L × H) and square footage computation.
- 3D Solid Mesh and 2D Floor Plan views with imperial (ft/in) and metric (m) unit conversion.
- Parametric CAD furniture mockups (sofas, tables, beds, doors) draggable inside rooms.
- Multi-room whole-house auto-stitching via shared doorway alignment.
- Local SQLite offline persistence and standard `.STL` file generation.

## Out of Scope (v1.0)
- Cloud account sync / user login (strictly local-first).
- Paid in-app purchases or paywalls.
- 3D Photogrammetry texture baking (v1 focuses on watertight geometric meshes).

## Non-Functional Requirements (NFRs)
| NFR-ID | Metric / Threshold | Workload / Device / Network | Verification Method | Evidence Owner |
|---|---|---|---|---|
| NFR-01 | Render frame rate ≥ 50 fps | iPhone 12 Pro or newer, 150k point cloud | Expo Profiler | QA Lead |
| NFR-02 | Cold launch to empty state < 800ms | Fresh app install, zero saved records | React Native Performance monitor | Frontend Lead |
| NFR-03 | Local DB query latency < 15ms | SQLite query across 50 room records | Automated jest benchmark | Service Lead |
| NFR-04 | 100% Offline Capability | Airplane mode with zero Wi-Fi / Cellular | E2E offline test suite | QA Lead |
| NFR-05 | Apple HIG Light Mode compliance | All 4 screens & dialogs | Visual UI audit | Architect |
