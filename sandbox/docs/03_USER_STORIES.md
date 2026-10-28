# 03 User Stories: LiDAR Room & Whole-House 3D Studio (iOS)

### US-001: Scanned Rooms Catalog & First-Class Empty State
**Priority:** P1 | **Effort:** 2 | **Role:** Homeowner / Drafter  
**Traceability:** Screen: `SCR-001`, Contract flag: `feat_first_class_empty`, `feat_local_persistence`  
**Touches:** UI: `RoomsCatalogScreen.tsx`, Hook: `useRoomsCatalog()`, Service: `roomRepository.ts`, DB: `rooms`  
**JTBD:** As an iOS user launching the app for the first time, I want a clean Apple-style empty state with an optional sample preview toggle, so that my production app contains zero fake data and I have an obvious path to scan my first room.  
**Acceptance Criteria (binary, observable):**
- [ ] **AC1 (Happy path - Empty)**: On fresh launch with an empty SQLite database, the screen displays the Apple Empty State ("No Rooms Scanned Yet") with a single primary CTA ("+ Scan Your First Room").
- [ ] **AC2 (Happy path - Populated)**: When rooms exist in SQLite, displays high-contrast cards with room name, dimensions, square footage, and timestamp.
- [ ] **AC3 (Sample Toggle)**: Toggling the segmented control to "Sample Projects" displays illustrative architectural mockups without inserting mock rows into the production `rooms` table.
- [ ] **AC4 (Light Mode Only)**: Canvas is `#f5f5f7`, cards are `#ffffff`, text is `#1c1c1e`. Zero dark mode themes.

---

### US-002: Realtime 3D LiDAR Scanner & Universal Simulation Fallback
**Priority:** P1 | **Effort:** 3 | **Role:** Homeowner / Drafter  
**Traceability:** Screen: `SCR-002`, Contract flag: `feat_realtime_lidar`, `feat_universal_fallback`, `feat_realtime_dimensions`  
**Touches:** UI: `LidarScannerScreen.tsx`, Hook: `useLidarScanner()`, Service: `scannerService.ts`, DB: `rooms`  
**JTBD:** As a user on any iOS device, I want a full-bleed 3D scanning viewport with live point cloud rendering and real-time dimension tags, so that I can capture watertight room meshes with guaranteed functionality even in simulation mode.  
**Acceptance Criteria (binary, observable):**
- [ ] **AC1 (Live Viewport)**: Renders full-bleed 3D viewport with 360° touch-orbit rotation and real-time point cloud density counter.
- [ ] **AC2 (Live Dimensions)**: Displays real-time measurement tags (W × L × H) dynamically updating as the scan bounds expand.
- [ ] **AC3 (Universal Simulation Fallback)**: If hardware LiDAR is unavailable, automatically activates realistic synthetic scanning simulation. Pressing "Finish Scan" persists real room records to SQLite.
- [ ] **AC4 (Zero Hollow Shells)**: Tap "Finish Scan" transitions to Studio with a fully generated, navigable 3D room mesh.

---

### US-003: 3D Room & 2D Architectural Floor Plan Studio with Units Toggle
**Priority:** P1 | **Effort:** 3 | **Role:** Homeowner / Drafter  
**Traceability:** Screen: `SCR-003`, Contract flag: `feat_2d_floorplan`, `feat_unit_conversion`  
**Touches:** UI: `RoomStudioScreen.tsx`, Hook: `useRoomStudio()`, Service: `geometryService.ts`, DB: `rooms`  
**JTBD:** As an architect or homeowner, I want to inspect my scanned room in both 3D Solid Mesh and 2D Architectural Floor Plan modes with instant ft ↔ m unit switching, so that I can analyze space dimensions accurately.  
**Acceptance Criteria (binary, observable):**
- [ ] **AC1 (3D / 2D Toggle)**: Tapping native segmented control toggles instantly between perspective 3D solid mesh and orthogonal 2D top-down blueprint.
- [ ] **AC2 (Unit Conversion)**: Tapping unit pill toggles all dimension callouts and area badges between imperial (ft/in, sq ft) and metric (m, m²) with instant re-calculation.
- [ ] **AC3 (Dimension Callouts)**: Wall measurements and ceiling height are clearly rendered with crisp high-contrast Apple typography.

---

### US-004: CAD Furniture Drag & Drop Layout Fitting
**Priority:** P1 | **Effort:** 2 | **Role:** Homeowner / Interior Designer  
**Traceability:** Screen: `SCR-003`, Contract flag: `feat_cad_furniture`  
**Touches:** UI: `RoomStudioScreen.tsx`, Hook: `useFurniturePlacement()`, Service: `furnitureRepository.ts`, DB: `furniture_items`  
**JTBD:** As an interior designer, I want to drop standard 3D furniture models into the room and drag them to test clearances, so that I can confirm furniture fits before purchasing.  
**Acceptance Criteria (binary, observable):**
- [ ] **AC1 (Furniture Tray)**: Horizontally scrollable tray presents furniture chips (Sofa, Dining Table, Coffee Table, King Bed, Doorway).
- [ ] **AC2 (Placement)**: Tapping a chip places a bounding model into the center of the active room and renders in both 3D and 2D views.
- [ ] **AC3 (Persistence)**: Furniture placements persist to SQLite under `furniture_items` associated with `room_id`.

---

### US-005: Standard 3D CAD Export (.STL)
**Priority:** P1 | **Effort:** 2 | **Role:** Drafter / 3D Maker  
**Traceability:** Screen: `SCR-003`, Contract flag: `feat_stl_export`  
**Touches:** UI: `RoomStudioScreen.tsx`, Hook: `useModelExporter()`, Service: `stlExporterService.ts`  
**JTBD:** As a 3D printing maker or CAD drafter, I want to export my room as a standard watertight `.STL` file, so that I can open it in AutoCAD, Blender, or 3D slicers.  
**Acceptance Criteria (binary, observable):**
- [ ] **AC1 (STL Generation)**: Tapping "Export 3D Mesh (.STL)" generates valid ASCII/binary STL facet geometry from the room bounds.
- [ ] **AC2 (Download / Share)**: Initiates file download or native iOS Share Sheet via `expo-sharing`.
- [ ] **AC3 (Success Confirmation)**: Triggers Apple-style confirmation toast with file size and polygon count.

---

### US-006: Multi-Room Whole-House Auto-Stitching
**Priority:** P1 | **Effort:** 3 | **Role:** Architect / Contractor  
**Traceability:** Screen: `SCR-004`, Contract flag: `feat_multi_room_stitch`  
**Touches:** UI: `WholeHouseStitchScreen.tsx`, Hook: `useHouseStitch()`, Service: `stitchEngine.ts`, DB: `house_projects`  
**JTBD:** As a general contractor, I want to combine multiple individual room scans into a composite whole-house model via shared doorways, so that I can visualize total house footprint and calculate entire floor area.  
**Acceptance Criteria (binary, observable):**
- [ ] **AC1 (Multi-Room Selection)**: Interactive chips toggle individual rooms in and out of the composite 3D viewport.
- [ ] **AC2 (Doorway Alignment)**: Auto-aligns adjacent rooms along detected doorway coordinates.
- [ ] **AC3 (Total Area Computation)**: Dynamically calculates and displays aggregated square footage.
- [ ] **AC4 (Master Export)**: "Export Full House 3D (.STL)" produces combined multi-room STL mesh file.
