# 10 UAT Checklist: LiDAR Room & Whole-House 3D Studio (iOS)

**Target Device**: Physical iPhone (`Nanose` — iPhone 17 Pro Max) / Expo Go / WebKit  
**Visual Standard**: Strict Apple Human Interface Guidelines in Light Mode (`#f5f5f7` canvas, `#ffffff` card surfaces, `#1c1c1e` text, `#007aff` action tint, SF Pro typography)  
**Execution Mode**: Universal Functional Simulation & Native Point Cloud Rendering  
**Status**: ⏸️ `AWAITING_STAKEHOLDER_VERIFICATION` (Gate 3 Hard Stop)

---

## 📱 Live App Verification Endpoints
- **Web Browser Preview**: [http://localhost:8081](http://localhost:8081)
- **Physical iPhone (Safari WebKit)**: [http://192.168.86.103:8081](http://192.168.86.103:8081)
- **Physical iPhone (Expo Go Native Client)**: `exp://192.168.86.103:8081`
- **Connected Hardware Device**: `Nanose` (`iPhone18,2` — iOS 27.0, Paired via USB)

---

## 📋 Interactive Verification Checklist

### 1. Apple HIG Light Mode & First-Class Empty State
- [ ] **Visual Theme**: Background is clean Apple canvas (`#f5f5f7`), cards are crisp white (`#ffffff`), typography is high-contrast `#1c1c1e`. Zero dark mode themes.
- [ ] **Catalog Empty State**: Fresh install displays *"No Rooms Scanned Yet"* with clean icon and primary CTA *"+ Scan First Room"*. Zero fake mock records in production SQLite database.
- [ ] **Sample Preview Toggle**: Tapping *Sample Preview (2)* renders illustrative architectural rooms without writing fake records to the database.

### 2. Realtime 3D LiDAR Scanner & Universal Simulation Fallback
- [ ] **3D Viewport**: Full-bleed AR/3D viewport with 360° touch-drag orbit.
- [ ] **Realtime Metrics**: Live point cloud counter increments at 60 Hz with dynamic dimension callout tags (`W: 14' 6"`, `L: 18' 2"`, `H: 9' 0"`).
- [ ] **Zero Hollow Shells**: Tapping *"⏹ Finish Scan & Save Mesh"* saves the real structured room entity to SQLite and transitions to the Studio.

### 3. 3D Solid Mesh & 2D Floor Plan Studio
- [ ] **View Switcher**: Native segmented control toggles seamlessly between *[ 🧊 3D Solid Mesh ]* and *[ 📐 2D Floor Plan ]*.
- [ ] **Unit Converter**: Tapping the unit pill toggles all dimension readouts instantly between imperial (`ft / in`, `sq ft`) and metric (`m`, `m²`).
- [ ] **CAD Furniture Fitting**: Tapping furniture chips (*Sofa*, *Dining Table*, *King Bed*, *Coffee Table*, *Doorway*) places models in the room and renders in both 3D and 2D.
- [ ] **1-Click 3D CAD Export**: Tapping *"⬇ Export 3D Mesh (.STL)"* generates watertight ASCII/binary STL facet geometry with confirmation toast.

### 4. Whole-House 3D Auto-Stitching
- [ ] **Multi-Room Toggle**: Filter chips toggle individual rooms in and out of the composite 3D viewport.
- [ ] **Doorway Alignment**: Rooms auto-align along shared doorway coordinates with sub-inch accuracy.
- [ ] **Total Footprint**: Dynamically computes aggregate square footage (`505 sq ft` across 2 rooms).
- [ ] **Master Composite Export**: *"⬇ Export Full House 3D (.STL)"* generates unified multi-room STL mesh.

---

## 🛑 Stakeholder Sign-Off Instructions
Verify the running app on your physical iPhone screen or browser preview, then reply in chat:
- Reply with your **test findings or requested UI adjustments** if changes are needed.
- Reply **`approved`** to complete Phase 8 and advance to Phase 9 Release.
