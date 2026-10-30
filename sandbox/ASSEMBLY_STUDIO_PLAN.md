# 🏛️ House Assembly Studio Overhaul — Master Plan & CAD Specification

> **Interactive Mockup Companion**: [`ASSEMBLY_STUDIO_MOCKUP.html`](./ASSEMBLY_STUDIO_MOCKUP.html)  
> **Target Screen Component**: `src/screens/HouseAssemblyScreen.tsx`  
> **Status**: **LOCKED DOWN & APPROVED BY STAKEHOLDER**

---

## 1. Executive Summary & Objective

The legacy House Assembly Studio relied on a cluttered 3-way mode switcher (`Auto-Solve | Manual Studio | 3D Dollhouse`), suffered from UI element collisions (room pills overlapping view toggles), displayed non-architectural diagonal line artifacts across rooms during corner snaps, and lacked a clean "add room by room" user workflow.

This overhaul redesigns the Assembly Studio into an **ultra-minimalist, Apple HIG Light Mode experience** governed by **rigorous CAD mathematical principles**:
1. **Simplified to 2 Tabs**: First tab named **`Studio`** (active focus) and second tab named **`3D Dollhouse`**.
2. **"Add 1 Room by 1 Room" Workflow**: An intuitive horizontal tray allowing users to select captured rooms and place them one-by-one onto the canvas.
3. **Collinear Magnetic Snapping**: Snaps flush along all 4 cardinal directions (North, South, East, West) with the diagonal slash bug eliminated.
4. **Minimalist Wall Merging**: A compact bottom-left icon pill `[ 🔗 Merge Walls ]` that floats only when two rooms touch flush along an edge.
5. **Thumb-Friendly `[ 2D | 3D ]` Switcher**: Positioned at the bottom-right of the viewport.
6. **Zero Text Clutter**: The active room toolbar uses sleek 30×30pt circular icon buttons (`↻` rotate and `✕` remove).
7. **Canonical Mathematical Truth**: World Coordinate Space $(X, Y, Z, \theta)$ serves as the immutable single source of truth—2D and 3D are exact mathematical projections of identical data with zero coordinate drift.
8. **Core Engine Untouched**: `geometryService.ts`, `stitchEngine.ts`, `stlExporterService.ts`, and `database.ts` remain 100% untouched.

---

## 2. Approved UI & Ergonomic Architecture

```text
┌────────────────────────────────────────────────────────┐
│ ‹ Rooms             House Assembly                Done │
├────────────────────────────────────────────────────────┤
│        [ Studio (2 on canvas) ]    [ 3D Dollhouse ]    │
├────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐ │
│ │ [ ● Kitchen   16' × 12' • 192 sq ft • 0° ] [↻] [✕] │ │  <-- Top Floating Room Dock
│ │                                                    │ │
│ │                                                    │ │
│ │                     CANVAS                         │ │
│ │          (2D Floorplan or 3D Isometric)            │ │
│ │             Pinch-to-Zoom & Drag-to-Pan            │ │
│ │                                                    │ │
│ │                                                    │ │
│ │ [🔗 Merge Walls (12')]                [ 2D | 3D ]  │ │  <-- Bottom-Left Action & Bottom-Right Toggle
│ └────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│ CAPTURED ROOMS — Tap to place 1 by 1 on canvas         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ │ Living Room  │ │ Kitchen      │ │ Primary Bed  │ ... │  <-- Bottom Room Tray Carousel
│ │ 20' × 14'    │ │ 16' × 12'    │ │ 15' × 14'    │     │
│ │ [✓ On Canvas]│ │ [✓ On Canvas]│ │[+ Add Studio]│     │
│ └──────────────┘ └──────────────┘ └──────────────┘     │
└────────────────────────────────────────────────────────┘
```

### Ergonomic Placement Breakdown:
- **Top Bar**: Minimalist navigation (`‹ Rooms`, room count / total square footage, `Done` for STL export).
- **Tabs**: 2 tabs (`Studio` and `3D Dollhouse`).
- **Canvas Top**: Floating selected room dock (name, dimensions, orientation) + 30×30pt circular icon buttons:
  - Soft-blue `↻` (Rotate 90° clockwise).
  - Soft-red `✕` (Remove from canvas, returns room back to bottom tray).
  - *No text labels—100% clean icon ergonomics.*
- **Canvas Bottom-Left**: Compact floating action button `[ 🔗 Merge Walls (L') ]` that appears only when an overlap interval $L_{\text{overlap}} > 0$ is detected.
- **Canvas Bottom-Right**: Compact floating view switcher: strictly **`[ 2D | 3D ]`**.
- **Canvas Bottom Tray**: Horizontal scrolling carousel of unplaced rooms (`+ Add to Studio`) and placed rooms (`✓ On Canvas`).

---

## 3. Mathematical Foundations & Computational Geometry

### A. Canonical World Coordinates & Metric Invariants
Every placed room on the studio canvas is parameterized in double-precision floating point world units (feet):
$$\mathbf{P}_{\text{room}} = \begin{pmatrix} X_c \\ Z_c \\ Y_{\text{elevation}} \\ \theta \end{pmatrix}, \quad \text{Dimensions: } \begin{pmatrix} W \\ L \\ H \end{pmatrix}$$

#### 1. Rigid-Body Rotation Matrix:
When rotating in $90^\circ$ increments ($\theta \in \{0, \frac{\pi}{2}, \pi, \frac{3\pi}{2}\}$):
$$\mathbf{R}(\theta) = \begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix}$$
- **Metric Conservation**: $\det(\mathbf{R}) = \cos^2\theta + \sin^2\theta \equiv +1.0$ (strictly positive, eliminating reflection or inverted chirality).
- **Orthogonality**: $\mathbf{R}^T \mathbf{R} = \mathbf{I}$, guaranteeing right angles remain $90.000^\circ$ and wall lengths remain invariant ($\Delta L = 0$).

#### 2. Local-to-World Corner Vertex Mapping:
$$\begin{pmatrix} X_i \\ Z_i \end{pmatrix} = \begin{pmatrix} X_c \\ Z_c \end{pmatrix} + \mathbf{R}(\theta) \begin{pmatrix} \pm \frac{W}{2} \\ \pm \frac{L}{2} \end{pmatrix}$$

---

### B. 1D Interval Overlap & Collinear Seam Snapping (Bug-Free Math)

Two rooms $A$ and $B$ snap along a shared boundary when:
1. **Normal Separation**: $|\Delta_{\text{normal}}| \le \epsilon_{\text{snap}} = 1.0\text{ ft}$.
2. **Collinear Seam Overlap Interval**:
   Along the touching axis (e.g. East/West touching at $X = X_{\text{seam}}$):
   $$Z_{\text{start}} = \max\left(Z_{c,A} - hl_A, \; Z_{c,B} - hl_B\right)$$
   $$Z_{\text{end}} = \min\left(Z_{c,A} + hl_A, \; Z_{c,B} + hl_B\right)$$
   $$\text{Overlap Length } L_{\text{overlap}} = Z_{\text{end}} - Z_{\text{start}}$$

#### Elimination of the Diagonal Slash Artifact:
- In the legacy code, the guide line connected $(X_{\min}, Z_{\min})$ to $(X_{\max}, Z_{\max})$, creating a diagonal slash across the room box.
- In this mathematical model, the snap guide vector is **strictly collinear with the shared wall**:
  $$\mathbf{G}_1 = \begin{pmatrix} X_{\text{seam}} \\ Z_{\text{start}} \end{pmatrix}, \quad \mathbf{G}_2 = \begin{pmatrix} X_{\text{seam}} \\ Z_{\text{end}} \end{pmatrix}$$
  Because $X_1 = X_2 = X_{\text{seam}}$, the line is **100% vertical** (or horizontal for North/South), strictly hugging the wall seam.

---

### C. Zero-Drift 2D $\leftrightarrow$ 3D Camera Projection

2D Floorplan and 3D Isometric View consume the **exact same** $\mathbf{P}_{\text{room}}$ world coordinates:

#### 1. 2D Orthographic Projection:
$$\begin{pmatrix} x_{2d} \\ y_{2d} \end{pmatrix} = \begin{pmatrix} \frac{W_{\text{view}}}{2} + X_w \cdot S_{2D} \cdot \zeta + \Delta x_{\text{pan}} \\ \frac{H_{\text{view}}}{2} + Z_w \cdot S_{2D} \cdot \zeta + \Delta y_{\text{pan}} \end{pmatrix}$$
*(where $\zeta$ is zoom scale factor, and $S_{2D} = 9.0\text{ px/ft}$).*

#### 2. 3D Perspective Projection (Pitch $\alpha$, Yaw $\beta$):
World coordinates $(X_w, Y_w, Z_w)$ undergo camera rotation:
$$\begin{pmatrix} X_1 \\ Z_1 \end{pmatrix} = \begin{pmatrix} \cos\beta & \sin\beta \\ -\sin\beta & \cos\beta \end{pmatrix} \begin{pmatrix} X_w \\ Z_w \end{pmatrix}$$
$$\begin{pmatrix} Y_2 \\ Z_2 \end{pmatrix} = \begin{pmatrix} \sin\alpha & -\cos\alpha \\ \cos\alpha & \sin\alpha \end{pmatrix} \begin{pmatrix} Y_w \\ Z_1 \end{pmatrix}$$
Perspective depth scaling ($f = 420$):
$$S_{\text{depth}} = \frac{f}{f + Z_2 + 280} \cdot \zeta$$
$$\begin{pmatrix} x_{3d} \\ y_{3d} \end{pmatrix} = \begin{pmatrix} \frac{W_{\text{view}}}{2} + X_1 \cdot S_{\text{depth}} + \Delta x_{\text{pan}} \\ \frac{H_{\text{view}}}{2} + Y_2 \cdot S_{\text{depth}} + \Delta y_{\text{pan}} \end{pmatrix}$$
- **Zero Coordinate Drift Guarantee**: Translating or rotating in 2D renders at the exact corresponding location in 3D, and vice versa.

---

### D. Watertight Manifold Partition Merging
When the user taps **Merge Walls**:
1. The two separate exterior walls ($t = 0.1651\text{m}$) are merged into **one interior partition** ($t = 0.1143\text{m}$).
2. The overlapping boundary is subtracted from total house area:
   $$A_{\text{total}} = A_A + A_B - \Delta A_{\text{partition}}$$
3. Downstream export to `.STL` / USDZ outputs certified 2-manifold geometry with zero internal zero-thickness faces.

---

## 4. Test Suite & Physical Device Verification Protocol

### A. Certified Automated Tests (15 / 15 Passed)
Run via `node test-runner.js`:
1. `US-001`: Fresh install SQLite database starts 100% empty.
2. `US-001`: Sample preview provides sample rooms without polluting database.
3. `US-001`: Deleting a scanned room removes it and restores empty state.
4. `US-002`: Lidar Scanner starts at 0 points in idle state.
5. `US-002`: Scanner Service produces valid 3D scan and commits real room entity.
6. `US-003`: Geometry Service accurately formats imperial & converts to metric.
7. `US-005`: STL Exporter Service generates valid ASCII solid mesh.
8. `US-006`: Stitch Engine calculates composite whole-house footprint correctly.
9. `EVAL-01`: STL Facet Normals point strictly outward (Rigid 90° rotation, $\det=+1.0$, Zero Mirroring).
10. `EVAL-02`: Degenerate epsilon-guard suppresses zero-area sub-prisms ($< 5\text{mm}$).
11. `EVAL-03`: Doorway void contains exactly ZERO triangles (Physical Cutout).
12. `EVAL-04`: Window void contains exactly ZERO triangles (Physical Cutout).
13. `EVAL-05`: Partial wall overlap merges into exactly ONE shared partition (0 double walls).
14. `EVAL-06`: Multi-story elevation increment equals exactly 9.0 ft ($108.0\text{ in}$).
15. `EVAL-07`: 3D Solid Model orientation matches physical reality.

### B. Physical iPhone Native Install & Vision OCR Verification Protocol
Whenever testing on a connected physical iPhone (`Nanose` / `iPhone 17 Pro Max`):
1. **Discover Device**:
   ```bash
   xcrun devicectl list devices
   ```
2. **Build Standalone Release App**:
   ```bash
   cd ios && \
   xcodebuild -workspace LiDARRoomStudio.xcworkspace \
     -scheme LiDARRoomStudio \
     -configuration Release \
     -destination "id=<DEVICE_UDID>" \
     -derivedDataPath /tmp/LiDARRoomStudioDerivedData build
   ```
3. **Direct Hardware Install**:
   ```bash
   xcrun devicectl device install app --device <DEVICE_UDID> /tmp/LiDARRoomStudioDerivedData/Build/Products/Release-iphoneos/LiDARRoomStudio.app
   ```
4. **Launch & Verify Foreground Process**:
   ```bash
   xcrun devicectl device process launch --device <DEVICE_UDID> --terminate-existing com.lidarstudio.roomscanner
   ```
5. **Capture Hardware Screenshot**:
   ```bash
   xcrun devicectl device capture screenshot --device <DEVICE_UDID> --destination /tmp/device_screen.png
   ```
6. **Run macOS Vision Framework OCR**:
   ```bash
   swift - << 'EOF'
   import Vision
   import AppKit
   guard let nsImage = NSImage(contentsOf: URL(fileURLWithPath: "/tmp/device_screen.png")),
         let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
   let req = VNRecognizeTextRequest { req, _ in
       (req.results as? [VNRecognizedTextObservation])?.forEach { print($0.topCandidates(1).first?.string ?? "") }
   }
   req.recognitionLevel = .accurate
   try? VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([req])
   EOF
   ```
7. **Assertions**:
   - Must contain: `"House Assembly"`, `"Studio"`, `"Captured Rooms"`, `"2D"`, `"3D"`.
   - Must NOT contain: `"RedBox"`, `"Fatal"`, `"Uncaught Error"`.

---

## 5. Portable Mockup File
The self-contained, standalone interactive HTML/SVG mockup is bundled right alongside this plan:
👉 [`ASSEMBLY_STUDIO_MOCKUP.html`](./ASSEMBLY_STUDIO_MOCKUP.html)

Open it in any web browser to test:
- 1-by-1 room addition
- 4-sided collinear magnetic snapping
- 90° rotation and deletion
- Merging walls into a shared interior partition
- Real-time 2D ⇄ 3D synchronization with zero coordinate drift
